import { createClient } from '@supabase/supabase-js';

// إنشاء اتصال مع Supabase بواسطة Service Role Key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // استقبال جميع الحقول الممكنة من الـ Body
    const { 
      name, 
      phone, 
      email, 
      lead_source, 
      folder, 
      desired_unit_type, 
      budget, 
      preferred_location,
      file_url 
    } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and phone are required' });
    }

    // إدخال البيانات في جدول leads
    const { data, error } = await supabaseAdmin
      .from('leads')
      .insert([
        {
          name: name,
          phone: phone,
          email: email || '',
          lead_source: lead_source || 'Facebook Ads',
          status: 'New Lead',
          folder: folder || null,
          desired_unit_type: desired_unit_type || null,
          budget: budget || null,
          preferred_location: preferred_location || null,
          file_url: file_url || null
        }
      ])
      .select();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ success: true, message: 'Lead added successfully', data });
  } catch (err) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
