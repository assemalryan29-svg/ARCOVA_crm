import { createClient } from '@supabase/supabase-js';

// تهيئة عميل Supabase باستخدام Service Role للتحكم الكامل
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // مفتاح الصلاحيات العليا لحفظ البيانات من الـ API الخارجي
);

export default async function handler(req, res) {
  // السماح فقط بطلبات POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    // 1. التحقق من المفتاح السري للحماية (API Key Authentication)
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.CUSTOM_API_SECRET_KEY) {
      return res.status(401).json({ success: false, message: 'Unauthorized: Invalid API Key' });
    }

    const { name, phone, email, lead_source, notes } = req.body;

    // 2. التحقق من البيانات الأساسية
    if (!phone) {
      return res.status(400).json({ success: false, message: 'رقم الهاتف مطلوب' });
    }

    // 3. إدخال العميل إلى قاعدة البيانات في Supabase
    const { data, error } = await supabase
      .from('leads')
      .insert([{
        name: name || 'عميل جديد عبر الـ API',
        phone: phone,
        email: email || '',
        lead_source: lead_source || 'External API',
        status: 'New Lead',
        temperature: 'Warm',
        notes: notes || ''
      }])
      .select()
      .single();

    if (error) throw error;

    // 4. (اختياري) تسجيل حدث في الـ lead_logs
    await supabase.from('lead_logs').insert([{
      lead_id: data.id,
      user_email: 'API System',
      action_type: 'System',
      content: '📥 تم استقبال العميل بنجاح عبر الـ API الخارجي'
    }]);

    return res.status(200).json({
      success: true,
      message: 'تم حفظ العميل بنجاح',
      lead: data
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
}
