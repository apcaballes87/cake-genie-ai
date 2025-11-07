-- Function to update the amount_collected field for a design based on paid contributions
CREATE OR REPLACE FUNCTION update_design_amount_collected(p_design_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Update the amount_collected field in cakegenie_shared_designs
  -- by summing all paid contributions for the design
  UPDATE cakegenie_shared_designs
  SET amount_collected = (
    SELECT COALESCE(SUM(amount), 0)
    FROM bill_contributions
    WHERE design_id = p_design_id
    AND status = 'paid'
  )
  WHERE design_id = p_design_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon and authenticated users
-- (They'll only be able to update designs they have access to based on RLS)
GRANT EXECUTE ON FUNCTION update_design_amount_collected(UUID) TO anon, authenticated;