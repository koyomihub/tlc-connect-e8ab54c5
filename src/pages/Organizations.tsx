import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function Organizations() {
  const [posts, setPosts] = useState<any[]>([]);

  useEffect(() => {
    fetchOrgPosts();
  }, []);

  const fetchOrgPosts = async () => {
    const { data } = await supabase
      .from('organization_posts')
      .select('*, organizations(name), profiles(display_name)')
      .order('created_at', { ascending: false });
    setPosts(data || []);
  };

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold flex items-center">
          <Building2 className="h-8 w-8 mr-2" />
          Organizations
        </h1>
        <div className="space-y-4">
          {posts.map(post => (
            <Card key={post.id}>
              <CardHeader>
                <CardTitle>{post.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p>{post.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
