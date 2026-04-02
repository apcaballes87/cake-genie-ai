# Merchant Chat Dashboard - Add Image Support

The merchant chat dashboard is already built. This prompt adds image sending capability for merchants to reply with images to customers.

---

## Changes Needed

### 1. Update Chat Modal UI

Add an image upload button to the chat input area:

```tsx
import { ImageIcon, Loader2, Send } from 'lucide-react';

const [selectedImage, setSelectedImage] = useState<File | null>(null);
const [isUploading, setIsUploading] = useState(false);
const fileInputRef = useRef<HTMLInputElement>(null);

// Image upload handler
const handleImageUpload = async (file: File) => {
    const supabase = createClient();
    const fileExt = file.name.split('.').pop();
    const fileName = `${conversationId}_${Date.now()}.${fileExt}`;
    
    const { data, error } = await supabase.storage
        .from('chat-images')
        .upload(`messages/${fileName}`, file);
    
    if (error) {
        console.error('Upload error:', error);
        return null;
    }
    
    const { data: urlData } = supabase.storage
        .from('chat-images')
        .getPublicUrl(`messages/${fileName}`);
    
    return urlData.publicUrl;
};

// In your send handler, check for image
const handleSend = async () => {
    let imageUrl = null;
    
    if (selectedImage) {
        setIsUploading(true);
        imageUrl = await handleImageUpload(selectedImage);
        setIsUploading(false);
        setSelectedImage(null);
    }
    
    // Send message with imageUrl
    await fetch(`/api/chat/${conversationId}`, {
        method: 'PATCH',
        body: JSON.stringify({
            action: 'send_merchant_reply',
            content: newMessage,
            imageUrl: imageUrl,
        }),
    });
};
```

### 2. Update API Route

Modify `PATCH /api/chat/[id]` to accept image:

```typescript
// In the send_merchant_reply action
const { content, imageUrl } = body;

const { data: message, error } = await supabaseAdmin
    .from('chat_messages')
    .insert({
        conversation_id: id,
        content,
        image_url: imageUrl || null,
        sender_type: 'merchant',
        is_read: true,
    })
    .select()
    .single();
```

### 3. Display Images in Message List

```tsx
{message.image_url && (
    <img 
        src={message.image_url} 
        alt="Attachment" 
        className="rounded-lg max-w-full mb-2 border border-slate-200"
    />
)}
```

---

## Storage Details

- **Bucket**: `chat-images` (already exists in Supabase)
- **Path**: `messages/{filename}`
- **Allowed types**: jpeg, jpg, png, webp, gif
- **Max size**: 10MB

---

## Testing

1. Send an image from customer app
2. Verify image displays in merchant dashboard
3. Reply with an image from merchant dashboard
4. Verify image appears in customer chat
