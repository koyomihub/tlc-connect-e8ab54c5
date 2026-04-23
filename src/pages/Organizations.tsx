import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function Organizations() {
  const navigate = useNavigate();
  const [organizations, setOrganizations] = useState<any[]>([]);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    const { data } = await supabase
      .from('organizations')
      .select('*')
      .order('name', { ascending: true });
    setOrganizations(data || []);
  };

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center bg-gradient-primary bg-clip-text text-transparent">
            <Building2 className="h-8 w-8 mr-2 text-primary" />
            Organizations
          </h1>
          <p className="text-muted-foreground mt-1">
            Official student organizations and clubs — click one to view its posts
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {organizations.map((org) => (
            <Card
              key={org.id}
              onClick={() => navigate(`/organizations/${org.id}`)}
              className="hover:shadow-md transition-shadow cursor-pointer hover:border-primary/50"
            >
              <CardHeader>
                <div className="flex items-center space-x-3">
                  {org.logo_url ? (
                    <img src={org.logo_url} alt={org.name} className="h-12 w-12 rounded-full" />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                  )}
                  <div>
                    <CardTitle className="text-lg">{org.name}</CardTitle>
                    {org.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{org.description}</p>
                    )}
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
