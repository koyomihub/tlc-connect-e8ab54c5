import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Bell, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { resolveNotificationTarget } from '@/lib/notificationNavigation';

export default function Notifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    fetchNotifications();
    subscribeToNotifications();
  }, [user]);

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from('notifications')
      .select(`
        *,
        actor:profiles!notifications_actor_id_fkey(display_name, avatar_url)
      `)
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false });

    setNotifications(data || []);
  };

  const subscribeToNotifications = () => {
    const channel = supabase
      .channel(`notifications-page-${user?.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user?.id}`,
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const markAsRead = async (notificationId: string) => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);
    
    fetchNotifications();
  };

  const handleNotificationClick = async (notification: any) => {
    if (!notification.is_read) {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notification.id);
    }
    const target = await resolveNotificationTarget(notification, user?.id);
    if (target) {
      navigate(target);
    }
  };

  const markAllAsRead = async () => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user?.id)
      .eq('is_read', false);
    
    fetchNotifications();
  };

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold flex items-center">
            <Bell className="h-8 w-8 mr-3" />
            Notifications
          </h1>
          {notifications.some(n => !n.is_read) && (
            <Button onClick={markAllAsRead} variant="outline">
              Mark All as Read
            </Button>
          )}
        </div>

        <div className="space-y-4">
          {notifications.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No notifications yet</p>
              </CardContent>
            </Card>
          ) : (
            notifications.map((notification) => (
              <Card
                key={notification.id}
                className={`transition-all hover:shadow-md ${(notification.post_id || notification.actor_id) ? 'cursor-pointer' : ''} ${
                  !notification.is_read ? 'border-primary bg-accent/50' : ''
                }`}
                onClick={() => handleNotificationClick(notification)}
              >
                <CardHeader>
                  <div className="flex items-start space-x-3">
                    {notification.type === 'group_invite' ? (
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <Users className="h-5 w-5 text-muted-foreground" />
                      </div>
                    ) : (
                      <Avatar>
                        <AvatarImage src={notification.actor?.avatar_url} />
                        <AvatarFallback>
                          {notification.actor?.display_name?.[0]?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className="flex-1 space-y-1">
                      <p className="text-sm">{notification.content}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                        })}
                      </p>
                      {!notification.is_read && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(notification.id);
                          }}
                        >
                          Mark as Read
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))
          )}
        </div>
      </div>
    </MainLayout>
  );
}
