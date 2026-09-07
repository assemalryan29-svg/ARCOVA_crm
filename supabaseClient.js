import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ilcdruyuhivhhsrkqjje.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlsY2RydXl1aGl2aGhzcmtxamplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzOTE2NzQsImV4cCI6MjEwMzk2NzY3NH0.UhFKSRq4LJ-2Fsgb0MMe3I6S60WPFEm0k4zFS4kncvI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
