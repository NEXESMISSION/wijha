Full Platform Spec: Manual Course Marketplace MVP

Stack (for now):

Video: Bunny Stream (HLS)

Frontend: Web app (React, Vue, or plain HTML/CSS/JS)

Backend: Node.js / Python / PHP

Database: relational (MySQL/Postgres) or NoSQL (MongoDB)

Edge Functions: optional for future tokenized playback

1. User Roles
1️⃣ Student

Can browse public courses

Can enroll (pending admin approval)

Can watch trailer videos for all courses

Access to course content only after enrollment is approved

Dashboard shows enrollment status (Pending/Approved/Rejected)

2️⃣ Creator

Can create/edit courses

Can upload videos and trailer videos

Can see approved enrollments payments, including:

Total course price

Platform percentage

Net earnings (course price minus platform fee)

Can request payouts via manual method

Course must be approved by Super Admin before appearing publicly

3️⃣ Super Admin

Full control

Approves/rejects courses

Approves/rejects student enrollments

Sees all payment proofs

Manages payout requests

Sends notes/messages to students if enrollment is rejected

2. Signup Flow

Signup page asks user to choose:

Student

Creator

Role determines dashboard layout

Accounts tracked with JWT sessions

3. Creator Flow
Dashboard

Create new course

Add: title, description, price, tags

Add modules and lessons

Upload videos + trailer

Submit course for admin approval

Course Status

Draft → Pending Approval → Published → Suspended

Only Published courses appear in public catalog

4. Public Course Page

Shows course details:

Title, description, price, creator info

Course outline

Enroll button opens popup

Trailer video is always visible

5. Student Enrollment Flow

Student clicks Enroll

Popup opens:

Price

Payment methods (bank transfer, mobile payment, cash, etc.)

Upload proof (image/text)

Submit button

On submit:

Enrollment created with status = Pending

Proof stored securely

Admin notified

Student dashboard:

Course appears

Status: Pending approval

All lessons locked except trailer

6. Admin Enrollment Approval Flow

Admin sees pending enrollments:

Student name/ID

Course

Uploaded proof

Notes (optional)

Admin actions:

Approve

Enrollment.status → Approved

Student gets access immediately to all course content

Email/notification sent

Dashboard shows all lessons unlocked

Reject

Enrollment.status → Rejected

Student sees Rejected popup:

“Your enrollment has been rejected. Reason: [admin note]”

Videos remain locked

7. Video Access & Security

Bunny Stream HLS only

Videos domain-locked

Signed URLs optional for future security

Backend check for every video:

User logged in?

User is student?

Enrollment approved?

Trailer video always unlocked

8. Dashboard Behavior
Student Dashboard

Shows all enrolled courses

Status indicators:

Pending approval

Approved

Rejected (with note popup)

Trailer video accessible for all courses

Creator Dashboard

Shows all created courses

Shows only approved enrollment payments, including:

Total price

Platform fee

Net earnings

Can request payout:

Click “Request Payout”

Select payment method

Enter amount ≤ total balance

Optional note

Cannot see pending/rejected enrollments or student receipts

Super Admin Dashboard

Full visibility:

All courses (draft, pending, published)

All enrollments

Payment proofs

Approve/reject courses

Approve/reject enrollments

Approve/reject payout requests

9. Payout Request Flow (Manual)

Creator clicks Request Payout

Popup asks:

Payment Method: Bank, Mobile, Cash

Amount

Optional note

Request stored in DB:

request_id, creator_id, amount, method, status = pending, submitted_at

Admin notified

Admin approves/rejects manually:

Approve → mark as paid, optional reference

Reject → note sent to creator

10. Data Model (Simplified)

Users

id, name, email, password, role, created_at

Courses

id, creator_id, title, description, price, status, created_at

Modules

id, course_id, title, order

Lessons

id, module_id, title, video_id, is_trailer (boolean), order

Enrollments

id, student_id, course_id, status (pending/approved/rejected), approved_by_admin_id, approved_at, created_at

Payment Proofs

id, enrollment_id, file_url or text, submitted_at, notes

Payout Requests

id, creator_id, amount, payment_method, status (pending/approved/rejected), submitted_at, admin_note

11. Key MVP Principles

Manual payments only (no gateway)

Admin approves everything (course & enrollment)

Creators see full course price, platform fee, net earnings

Creator can request payouts

Trailer videos always visible

Enrollment approval/rejection popups with admin notes

Simple dashboards, clear workflow for all roles