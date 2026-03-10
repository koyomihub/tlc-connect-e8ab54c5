
-- Fix post_likes: drop restrictive policies, recreate as permissive
DROP POLICY IF EXISTS "Likes are viewable by everyone" ON public.post_likes;
DROP POLICY IF EXISTS "Users can like posts" ON public.post_likes;
DROP POLICY IF EXISTS "Users can unlike posts" ON public.post_likes;

CREATE POLICY "Likes are viewable by everyone" ON public.post_likes FOR SELECT USING (true);
CREATE POLICY "Users can like posts" ON public.post_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike posts" ON public.post_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Fix post_comments: drop restrictive policies, recreate as permissive
DROP POLICY IF EXISTS "Comments are viewable by everyone" ON public.post_comments;
DROP POLICY IF EXISTS "Users can create comments" ON public.post_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON public.post_comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON public.post_comments;

CREATE POLICY "Comments are viewable by everyone" ON public.post_comments FOR SELECT USING (true);
CREATE POLICY "Users can create comments" ON public.post_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own comments" ON public.post_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own comments" ON public.post_comments FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Fix posts: drop restrictive write policies, recreate as permissive
DROP POLICY IF EXISTS "Users can create posts" ON public.posts;
DROP POLICY IF EXISTS "Users can delete their own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can update their own posts" ON public.posts;

CREATE POLICY "Users can create posts" ON public.posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own posts" ON public.posts FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own posts" ON public.posts FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Fix follows
DROP POLICY IF EXISTS "Follows are viewable by everyone" ON public.follows;
DROP POLICY IF EXISTS "Users can follow others" ON public.follows;
DROP POLICY IF EXISTS "Users can unfollow others" ON public.follows;

CREATE POLICY "Follows are viewable by everyone" ON public.follows FOR SELECT USING (true);
CREATE POLICY "Users can follow others" ON public.follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users can unfollow others" ON public.follows FOR DELETE TO authenticated USING (auth.uid() = follower_id);

-- Fix threads
DROP POLICY IF EXISTS "Threads are viewable by everyone" ON public.threads;
DROP POLICY IF EXISTS "Users can create threads" ON public.threads;
DROP POLICY IF EXISTS "Users can delete their own threads" ON public.threads;
DROP POLICY IF EXISTS "Users can update their own threads" ON public.threads;

CREATE POLICY "Threads are viewable by everyone" ON public.threads FOR SELECT USING (true);
CREATE POLICY "Users can create threads" ON public.threads FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own threads" ON public.threads FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own threads" ON public.threads FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Fix thread_replies
DROP POLICY IF EXISTS "Thread replies are viewable by everyone" ON public.thread_replies;
DROP POLICY IF EXISTS "Users can create replies" ON public.thread_replies;
DROP POLICY IF EXISTS "Users can delete their own replies" ON public.thread_replies;
DROP POLICY IF EXISTS "Users can update their own replies" ON public.thread_replies;
DROP POLICY IF EXISTS "Thread creators can delete replies" ON public.thread_replies;

CREATE POLICY "Thread replies are viewable by everyone" ON public.thread_replies FOR SELECT USING (true);
CREATE POLICY "Users can create replies" ON public.thread_replies FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own replies" ON public.thread_replies FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Thread creators can delete replies" ON public.thread_replies FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM threads WHERE threads.id = thread_replies.thread_id AND threads.user_id = auth.uid()));
CREATE POLICY "Users can update their own replies" ON public.thread_replies FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Fix thread_likes
DROP POLICY IF EXISTS "Thread likes are viewable by everyone" ON public.thread_likes;
DROP POLICY IF EXISTS "Users can like threads" ON public.thread_likes;
DROP POLICY IF EXISTS "Users can unlike threads" ON public.thread_likes;

CREATE POLICY "Thread likes are viewable by everyone" ON public.thread_likes FOR SELECT USING (true);
CREATE POLICY "Users can like threads" ON public.thread_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike threads" ON public.thread_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Fix reply_likes
DROP POLICY IF EXISTS "Reply likes are viewable by everyone" ON public.reply_likes;
DROP POLICY IF EXISTS "Users can like replies" ON public.reply_likes;
DROP POLICY IF EXISTS "Users can unlike replies" ON public.reply_likes;

CREATE POLICY "Reply likes are viewable by everyone" ON public.reply_likes FOR SELECT USING (true);
CREATE POLICY "Users can like replies" ON public.reply_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike replies" ON public.reply_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Fix thread_views
DROP POLICY IF EXISTS "Thread views are viewable by everyone" ON public.thread_views;
DROP POLICY IF EXISTS "Authenticated users can record a view" ON public.thread_views;

CREATE POLICY "Thread views are viewable by everyone" ON public.thread_views FOR SELECT USING (true);
CREATE POLICY "Authenticated users can record a view" ON public.thread_views FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL AND (user_id IS NULL OR user_id = auth.uid()));

-- Fix reposts
DROP POLICY IF EXISTS "Reposts are viewable by everyone" ON public.reposts;
DROP POLICY IF EXISTS "Users can create reposts" ON public.reposts;
DROP POLICY IF EXISTS "Users can delete their reposts" ON public.reposts;

CREATE POLICY "Reposts are viewable by everyone" ON public.reposts FOR SELECT USING (true);
CREATE POLICY "Users can create reposts" ON public.reposts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their reposts" ON public.reposts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Fix groups
DROP POLICY IF EXISTS "Groups are viewable by everyone" ON public.groups;
DROP POLICY IF EXISTS "Users can create groups" ON public.groups;
DROP POLICY IF EXISTS "Group creators can update groups" ON public.groups;
DROP POLICY IF EXISTS "Group creators can delete groups" ON public.groups;

CREATE POLICY "Groups are viewable by everyone" ON public.groups FOR SELECT USING (true);
CREATE POLICY "Users can create groups" ON public.groups FOR INSERT TO authenticated WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Group creators can update groups" ON public.groups FOR UPDATE TO authenticated USING (auth.uid() = creator_id);
CREATE POLICY "Group creators can delete groups" ON public.groups FOR DELETE TO authenticated USING (auth.uid() = creator_id);

-- Fix group_members
DROP POLICY IF EXISTS "Group members are viewable by everyone" ON public.group_members;
DROP POLICY IF EXISTS "Users can join groups" ON public.group_members;
DROP POLICY IF EXISTS "Users can leave groups" ON public.group_members;

CREATE POLICY "Group members are viewable by everyone" ON public.group_members FOR SELECT USING (true);
CREATE POLICY "Users can join groups" ON public.group_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave groups" ON public.group_members FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Fix group_messages
DROP POLICY IF EXISTS "Group members can view messages" ON public.group_messages;
DROP POLICY IF EXISTS "Group members can send messages" ON public.group_messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON public.group_messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON public.group_messages;

CREATE POLICY "Group members can view messages" ON public.group_messages FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM group_members WHERE group_members.group_id = group_messages.group_id AND group_members.user_id = auth.uid()));
CREATE POLICY "Group members can send messages" ON public.group_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM group_members WHERE group_members.group_id = group_messages.group_id AND group_members.user_id = auth.uid()));
CREATE POLICY "Users can delete their own messages" ON public.group_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own messages" ON public.group_messages FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Fix profiles
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Fix group_invitations
DROP POLICY IF EXISTS "Users can view their own invitations" ON public.group_invitations;
DROP POLICY IF EXISTS "Group admins can send invitations" ON public.group_invitations;
DROP POLICY IF EXISTS "Users can update their own invitations" ON public.group_invitations;

CREATE POLICY "Users can view their own invitations" ON public.group_invitations FOR SELECT TO authenticated USING (auth.uid() = invitee_id OR auth.uid() = inviter_id);
CREATE POLICY "Group admins can send invitations" ON public.group_invitations FOR INSERT TO authenticated WITH CHECK (auth.uid() = inviter_id AND EXISTS (SELECT 1 FROM group_members WHERE group_members.group_id = group_invitations.group_id AND group_members.user_id = auth.uid() AND group_members.is_admin = true));
CREATE POLICY "Users can update their own invitations" ON public.group_invitations FOR UPDATE TO authenticated USING (auth.uid() = invitee_id);

-- Fix notifications
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;

CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Fix token_transactions
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.token_transactions;

CREATE POLICY "Users can view their own transactions" ON public.token_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Fix user_roles
DROP POLICY IF EXISTS "Anyone can view roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins can manage roles" ON public.user_roles;

CREATE POLICY "Anyone can view roles" ON public.user_roles FOR SELECT USING (true);
CREATE POLICY "Only admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (is_admin(auth.uid()));

-- Fix organizations
DROP POLICY IF EXISTS "Organizations are viewable by everyone" ON public.organizations;
DROP POLICY IF EXISTS "Only admins can manage organizations" ON public.organizations;

CREATE POLICY "Organizations are viewable by everyone" ON public.organizations FOR SELECT USING (true);
CREATE POLICY "Only admins can manage organizations" ON public.organizations FOR ALL TO authenticated USING (is_admin(auth.uid()));

-- Fix organization_members
DROP POLICY IF EXISTS "Organization members are viewable by everyone" ON public.organization_members;
DROP POLICY IF EXISTS "Only admins can manage org members" ON public.organization_members;

CREATE POLICY "Organization members are viewable by everyone" ON public.organization_members FOR SELECT USING (true);
CREATE POLICY "Only admins can manage org members" ON public.organization_members FOR ALL TO authenticated USING (is_admin(auth.uid()));

-- Fix organization_posts
DROP POLICY IF EXISTS "Organization posts are viewable by everyone" ON public.organization_posts;
DROP POLICY IF EXISTS "Teachers and officers can create org posts" ON public.organization_posts;
DROP POLICY IF EXISTS "Users can delete their own org posts" ON public.organization_posts;
DROP POLICY IF EXISTS "Users can update their own org posts" ON public.organization_posts;

CREATE POLICY "Organization posts are viewable by everyone" ON public.organization_posts FOR SELECT USING (true);
CREATE POLICY "Teachers and officers can create org posts" ON public.organization_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND (has_role(auth.uid(), 'teacher'::app_role) OR has_role(auth.uid(), 'officer'::app_role)));
CREATE POLICY "Users can delete their own org posts" ON public.organization_posts FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own org posts" ON public.organization_posts FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Fix nft_items
DROP POLICY IF EXISTS "NFT items are viewable by everyone" ON public.nft_items;
DROP POLICY IF EXISTS "Only admins can manage NFT items" ON public.nft_items;

CREATE POLICY "NFT items are viewable by everyone" ON public.nft_items FOR SELECT USING (true);
CREATE POLICY "Only admins can manage NFT items" ON public.nft_items FOR ALL TO authenticated USING (is_admin(auth.uid()));

-- Fix user_nfts
DROP POLICY IF EXISTS "Users can view their own NFTs" ON public.user_nfts;
DROP POLICY IF EXISTS "Users can view others' NFTs" ON public.user_nfts;
DROP POLICY IF EXISTS "Users can purchase NFTs" ON public.user_nfts;

CREATE POLICY "Users can view NFTs" ON public.user_nfts FOR SELECT USING (true);
CREATE POLICY "Users can purchase NFTs" ON public.user_nfts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
