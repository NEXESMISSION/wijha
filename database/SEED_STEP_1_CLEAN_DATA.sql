-- ============================================
-- STEP 1: CLEAN ALL EXISTING DATA
-- ============================================
-- Run this first to delete all existing data
-- ============================================

DELETE FROM course_comments;
DELETE FROM course_likes;
DELETE FROM course_ratings;
DELETE FROM creator_profile_comments;
DELETE FROM creator_profile_ratings;
DELETE FROM reports;
DELETE FROM payment_proofs;
DELETE FROM enrollments;
DELETE FROM lessons;
DELETE FROM modules;
DELETE FROM courses;
DELETE FROM categories;
DELETE FROM payout_requests;
-- Note: We keep profiles - they will be updated in step 3

