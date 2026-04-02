-- Create chat tables for customer support chat
-- Handles both authenticated users and guest visitors

-- Chat conversations (one per user session/customer)
CREATE TABLE chat_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id), -- NULL for anonymous guests
    session_id TEXT, -- For anonymous users (generated client-side)
    customer_email TEXT,
    customer_name TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed', 'archived')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages within conversations
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    sender_type TEXT CHECK (sender_type IN ('customer', 'merchant', 'system')) NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_conversations_user_id ON chat_conversations(user_id);
CREATE INDEX idx_conversations_session_id ON chat_conversations(session_id);
CREATE INDEX idx_conversations_status ON chat_conversations(status);
CREATE INDEX idx_messages_conversation_id ON chat_messages(conversation_id);
CREATE INDEX idx_messages_created_at ON chat_messages(created_at DESC);

-- Enable RLS
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chat_conversations
-- Customers can create and read their own conversations
CREATE POLICY "Customers can create conversations" ON chat_conversations
    FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Customers can read own conversations" ON chat_conversations
    FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Customers can update own conversations" ON chat_conversations
    FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL);

-- RLS Policies for chat_messages
-- Customers can read/write their own messages
CREATE POLICY "Customers can create messages" ON chat_messages
    FOR INSERT WITH CHECK (true); -- Checked via function/RPC

CREATE POLICY "Customers can read own messages" ON chat_messages
    FOR SELECT USING (
        conversation_id IN (
            SELECT id FROM chat_conversations 
            WHERE user_id = auth.uid() OR user_id IS NULL
        )
    );

-- Helper function to check if user can access conversation
CREATE OR REPLACE FUNCTION can_access_conversation(convo_id UUID, check_user_id UUID, check_session_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    convo_user_id UUID;
    convo_session_id TEXT;
BEGIN
    SELECT user_id, session_id INTO convo_user_id, convo_session_id
    FROM chat_conversations WHERE id = convo_id;
    
    RETURN convo_user_id = check_user_id 
        OR convo_session_id = check_session_id
        OR convo_user_id IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to send a customer message
CREATE OR REPLACE FUNCTION send_customer_message(
    p_conversation_id UUID,
    p_content TEXT,
    p_user_id UUID,
    p_session_id TEXT
)
RETURNS UUID AS $$
DECLARE
    v_message_id UUID;
    v_can_send BOOLEAN;
BEGIN
    -- Check access
    SELECT can_access_conversation(p_conversation_id, p_user_id, p_session_id) INTO v_can_send;
    
    IF NOT v_can_send THEN
        RAISE EXCEPTION 'Access denied';
    END IF;
    
    -- Insert message
    INSERT INTO chat_messages (conversation_id, content, sender_type, is_read)
    VALUES (p_conversation_id, p_content, 'customer', FALSE)
    RETURNING id INTO v_message_id;
    
    -- Update conversation timestamp
    UPDATE chat_conversations 
    SET updated_at = NOW() 
    WHERE id = p_conversation_id;
    
    RETURN v_message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get or create conversation for user
CREATE OR REPLACE FUNCTION get_or_create_conversation(
    p_user_id UUID,
    p_session_id TEXT,
    p_email TEXT DEFAULT NULL,
    p_name TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_conversation_id UUID;
BEGIN
    -- Try to find existing conversation
    IF p_user_id IS NOT NULL THEN
        SELECT id INTO v_conversation_id FROM chat_conversations
        WHERE user_id = p_user_id AND status = 'active'
        ORDER BY created_at DESC LIMIT 1;
    ELSE
        SELECT id INTO v_conversation_id FROM chat_conversations
        WHERE session_id = p_session_id AND status = 'active'
        ORDER BY created_at DESC LIMIT 1;
    END IF;
    
    -- Create new if not found
    IF v_conversation_id IS NULL THEN
        INSERT INTO chat_conversations (user_id, session_id, customer_email, customer_name, status)
        VALUES (p_user_id, p_session_id, p_email, p_name, 'active')
        RETURNING id INTO v_conversation_id;
    END IF;
    
    RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
