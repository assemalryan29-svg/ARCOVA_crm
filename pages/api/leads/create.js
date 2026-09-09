import { createClient } from '@supabase/supabase-js';

// إنشاء اتصال باستخدام Service Role Key لضمان صلاحية الكتابة من السيرفر
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // السماح فقط بطلبات POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, phone, email, lead_source } = req.body;

    // التحقق من البيانات الأساسية
    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and phone are required' });
    }

    // إدخال العميل في جدول leads
    const { data, error } = await supabaseAdmin
      .from('leads')
      .insert([
        {
          name: name,
          phone: phone,
          email: email || '',
          lead_source: lead_source || 'Facebook Ads',
          status: 'New Lead'
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
