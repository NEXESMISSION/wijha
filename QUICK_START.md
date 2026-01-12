# Quick Start Guide

## Installation & Running

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

3. **Open browser:**
   Navigate to `http://localhost:5173`

## Testing the Application

### Login with Demo Accounts

Use these pre-configured accounts:

- **Student**: `student@test.com` / `password`
- **Creator**: `creator@test.com` / `password`  
- **Admin**: `admin@test.com` / `password`

### Or Create New Account

1. Click "Sign up" on the login page
2. Fill in your details
3. Select your role (Student or Creator)
4. You'll be automatically logged in

## Navigation Flow

### As a Student:
1. Login → See Dashboard with enrolled courses
2. Click "Browse Courses" → View all available courses
3. Click on a course → View details and trailer
4. Click "Enroll Now" → Upload payment proof
5. Wait for admin approval
6. Once approved → Access all course content

### As a Creator:
1. Login → See Dashboard with courses and earnings
2. Click "Create Course" → Fill in course details
3. Add modules and lessons
4. Upload trailer video
5. Submit for admin approval
6. View earnings breakdown
7. Request payouts when ready

### As an Admin:
1. Login → See Admin Dashboard
2. Switch between tabs:
   - **Courses**: Approve/reject new courses
   - **Enrollments**: Approve/reject student enrollments
   - **Payouts**: Approve/reject creator payout requests
3. View payment proofs
4. Add rejection notes when needed

## Key Features Implemented

✅ Authentication (Login/Signup with role selection)  
✅ Student Dashboard (enrollment status tracking)  
✅ Creator Dashboard (earnings & payout requests)  
✅ Admin Dashboard (full management interface)  
✅ Course Browsing (public catalog)  
✅ Course Detail Page (with trailer and enrollment)  
✅ Course Creation/Editing (for creators)  
✅ Enrollment Flow (with payment proof upload)  
✅ Payout Request System  
✅ Role-based Navigation  
✅ Protected Routes  

## Notes

- All data is **mocked** (no backend)
- Forms show alerts instead of API calls
- Authentication persists in localStorage
- Refresh page to see persisted login state

## Next Steps for Production

1. Connect to backend API
2. Replace mock data with real API calls
3. Implement JWT token authentication
4. Add video streaming (Bunny Stream HLS)
5. Add form validation
6. Add loading states
7. Add error handling
8. Add tests

