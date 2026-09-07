  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    // طباعة للتحقق من وصول المفاتيح
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      setErrorMsg('خطأ: متغيرات البيئة غير معرفة في Vercel');
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await Promise.race([
        supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password,
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('انتهت مهلة الاتصال بالخادم (Timeout)')), 8000)
        )
      ]);

      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
      } else if (data?.user) {
        window.location.href = '/dashboard';
      }
    } catch (err) {
      setErrorMsg(err.message);
      setLoading(false);
    }
  };
