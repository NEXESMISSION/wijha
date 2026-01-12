    -- ============================================
    -- ADD REPORTS TABLE
    -- Allows users to report courses, comments, etc.
    -- ============================================

    -- Reports table
    CREATE TABLE IF NOT EXISTS reports (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    reporter_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    report_type TEXT NOT NULL CHECK (report_type IN ('course', 'comment', 'profile', 'course_comment', 'profile_comment')),
    reported_item_id UUID NOT NULL, -- Can be course_id, comment_id, creator_id, etc.
    reason TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
    reviewed_by_admin_id UUID REFERENCES profiles(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
    CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(report_type);
    CREATE INDEX IF NOT EXISTS idx_reports_reporter_id ON reports(reporter_id);
    CREATE INDEX IF NOT EXISTS idx_reports_reported_item ON reports(report_type, reported_item_id);

    -- Enable RLS
    ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

    -- RLS Policies
    DROP POLICY IF EXISTS "Users can create reports" ON reports;
    CREATE POLICY "Users can create reports"
    ON reports FOR INSERT
    WITH CHECK (auth.uid() = reporter_id AND auth.uid() IS NOT NULL);

    DROP POLICY IF EXISTS "Users can view their own reports" ON reports;
    CREATE POLICY "Users can view their own reports"
    ON reports FOR SELECT
    USING (auth.uid() = reporter_id);

    DROP POLICY IF EXISTS "Admins can view all reports" ON reports;
    CREATE POLICY "Admins can view all reports"
    ON reports FOR SELECT
    USING (
        EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

    DROP POLICY IF EXISTS "Admins can update reports" ON reports;
    CREATE POLICY "Admins can update reports"
    ON reports FOR UPDATE
    USING (
        EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

    -- Trigger for updated_at
    DROP TRIGGER IF EXISTS update_reports_updated_at ON reports;
    CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    -- ============================================
    -- DONE!
    -- ============================================

