import { supabase } from './supabase'

// Profiles API
export const getProfile = async (userId) => {
  try {
    // Use maybeSingle() instead of single() - returns null if no rows found instead of error
    const queryPromise = supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle() // Returns null if no rows, instead of throwing error
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Query timeout')), 8000)
    )
    
    const { data, error } = await Promise.race([queryPromise, timeoutPromise])
    
    if (error) {
      // Handle specific error codes
      if (error.code === 'PGRST116' || error.message?.includes('406') || error.message?.includes('Cannot coerce')) {
        return null
      }
      throw error
    }
    
    // maybeSingle returns null if no rows found
    return data
  } catch (err) {
    // If timeout or network error, return null instead of throwing
    if (err.message === 'Query timeout' || err.message === 'Profile load timeout') {
      return null
    }
    // Handle 406 errors gracefully
    if (err.message?.includes('406') || err.message?.includes('Cannot coerce')) {
      return null
    }
    throw err
  }
}

// Create profile if it doesn't exist (for users created before trigger was set up)
export const createProfileIfMissing = async (userId, userMetadata = {}) => {
  try {
    // First check if profile exists
    const existingProfile = await getProfile(userId)
    if (existingProfile) {
      return existingProfile
    }
    
    // Profile doesn't exist, create it
    const { data, error } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        name: userMetadata.name || userMetadata.user_metadata?.name || 'User',
        role: userMetadata.role || userMetadata.user_metadata?.role || 'student',
      })
      .select()
      .single()
    
    if (error) {
      // If error is "duplicate key" or "already exists", try fetching again
      if (error.code === '23505' || error.message?.includes('duplicate')) {
        return await getProfile(userId)
      }
      throw error
    }
    
    return data
  } catch (err) {
    // If creation fails, try to get existing profile
    return await getProfile(userId)
  }
}

export const updateProfile = async (userId, updates) => {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()
  
  if (error) throw error
  return data
}

// Courses API
export const getPublishedCourses = async () => {
  const { data, error } = await supabase
    .from('courses')
    .select(`
      *,
      profiles:creator_id (
        id,
        name,
        profile_slug,
        profile_image_url
      ),
      categories:category_id (
        id,
        name,
        icon
      )
    `)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data
}

export const getCourseById = async (courseId) => {
  const { data, error } = await supabase
    .from('courses')
    .select(`
      *,
      profiles:creator_id (
        id,
        name
      )
    `)
    .eq('id', courseId)
    .single()
  
  if (error) throw error
  return data
}

export const getCourseWithModules = async (courseId) => {
  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select(`
      *,
      profiles:creator_id (
        id,
        name,
        profile_slug,
        profile_image_url
      ),
      categories:category_id (
        id,
        name,
        icon
      )
    `)
    .eq('id', courseId)
    .single()
  
  if (courseError) throw courseError

  const { data: modules, error: modulesError } = await supabase
    .from('modules')
    .select(`
      *,
      lessons (*)
    `)
    .eq('course_id', courseId)
    .order('order_index', { ascending: true })
  
  if (modulesError) throw modulesError

  // Sort lessons within each module
  if (modules) {
    modules.forEach(module => {
      if (module.lessons) {
        module.lessons.sort((a, b) => a.order_index - b.order_index)
      }
    })
  }

  return { ...course, modules: modules || [] }
}

export const getCreatorCourses = async (creatorId) => {
  // First, get courses without nested query to avoid RLS issues
  const { data: courses, error: coursesError } = await supabase
    .from('courses')
    .select('*')
    .eq('creator_id', creatorId)
    .order('created_at', { ascending: false })
  
  if (coursesError) throw coursesError
  
  // If no courses, return empty array
  if (!courses || courses.length === 0) {
    return []
  }
  
  // Get category IDs
  const categoryIds = courses
    .map(c => c.category_id)
    .filter(id => id !== null)
  
  // Get categories if there are any
  let categoriesMap = {}
  if (categoryIds.length > 0) {
    const { data: categories, error: categoriesError } = await supabase
      .from('categories')
      .select('id, name, icon')
      .in('id', categoryIds)
    
    if (!categoriesError && categories) {
      categories.forEach(cat => {
        categoriesMap[cat.id] = cat
      })
    }
  }
  
  // Merge categories into courses
  return courses.map(course => ({
    ...course,
    categories: course.category_id ? categoriesMap[course.category_id] || null : null
  }))
}

export const createCourse = async (courseData) => {
  const { data, error } = await supabase
    .from('courses')
    .insert(courseData)
    .select(`
      *,
      categories:category_id (
        id,
        name,
        icon
      )
    `)
    .single()
  
  if (error) throw error
  return data
}

export const updateCourse = async (courseId, updates) => {
  const { data, error } = await supabase
    .from('courses')
    .update(updates)
    .eq('id', courseId)
    .select()
    .single()
  
  if (error) throw error
  return data
}

export const updateCourseStatus = async (courseId, status, adminId) => {
  const updates = { status }
  if (status === 'published') {
    updates.approved_by_admin_id = adminId
    updates.approved_at = new Date().toISOString()
  }
  
  const { data, error } = await supabase
    .from('courses')
    .update(updates)
    .eq('id', courseId)
    .select()
    .single()
  
  if (error) throw error
  return data
}

export const deleteCourse = async (courseId) => {
  // Cascading deletes will handle modules, lessons, enrollments, and payment proofs
  const { error } = await supabase
    .from('courses')
    .delete()
    .eq('id', courseId)
  
  if (error) throw error
}

// Modules API
export const createModule = async (moduleData) => {
  const { data, error } = await supabase
    .from('modules')
    .insert(moduleData)
    .select()
    .single()
  
  if (error) throw error
  return data
}

export const updateModule = async (moduleId, updates) => {
  const { data, error } = await supabase
    .from('modules')
    .update(updates)
    .eq('id', moduleId)
    .select()
    .single()
  
  if (error) throw error
  return data
}

export const deleteModule = async (moduleId) => {
  const { error } = await supabase
    .from('modules')
    .delete()
    .eq('id', moduleId)
  
  if (error) throw error
}

// Lessons API
export const createLesson = async (lessonData) => {
  const { data, error } = await supabase
    .from('lessons')
    .insert(lessonData)
    .select()
    .single()
  
  if (error) throw error
  return data
}

export const updateLesson = async (lessonId, updates) => {
  const { data, error } = await supabase
    .from('lessons')
    .update(updates)
    .eq('id', lessonId)
    .select()
    .single()
  
  if (error) throw error
  return data
}

export const deleteLesson = async (lessonId) => {
  const { error } = await supabase
    .from('lessons')
    .delete()
    .eq('id', lessonId)
  
  if (error) throw error
}

// Enrollments API
export const getStudentEnrollments = async (studentId) => {
  const { data, error } = await supabase
    .from('enrollments')
    .select(`
      *,
      courses (
        id,
        title,
        description,
        price,
        trailer_video_url,
        thumbnail_image_url
      )
    `)
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data
}

// Check if student is restricted from enrolling in a course
export const checkEnrollmentRestriction = async (studentId, courseId) => {
  const { data, error } = await supabase
    .from('enrollments')
    .select('is_restricted, restriction_reason')
    .eq('student_id', studentId)
    .eq('course_id', courseId)
    .eq('is_restricted', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  
  if (error) throw error
  return data
}

export const createEnrollment = async (enrollmentData) => {
  // Check if student is restricted
  const restriction = await checkEnrollmentRestriction(
    enrollmentData.student_id,
    enrollmentData.course_id
  )
  
  if (restriction) {
    throw new Error(restriction.restriction_reason || 'You are restricted from enrolling in this course')
  }
  
  // Check if there's already a pending or approved enrollment
  const { data: existing, error: checkError } = await supabase
    .from('enrollments')
    .select('id, status')
    .eq('student_id', enrollmentData.student_id)
    .eq('course_id', enrollmentData.course_id)
    .in('status', ['pending', 'approved'])
    .maybeSingle()
  
  if (checkError && checkError.code !== 'PGRST116') throw checkError
  
  if (existing) {
    if (existing.status === 'pending') {
      throw new Error('You already have a pending enrollment request for this course')
    }
    if (existing.status === 'approved') {
      throw new Error('You are already enrolled in this course')
    }
  }
  
  const { data, error } = await supabase
    .from('enrollments')
    .insert(enrollmentData)
    .select(`
      *,
      courses (*)
    `)
    .single()
  
  if (error) throw error
  return data
}

export const updateEnrollmentStatus = async (enrollmentId, status, adminId, rejectionNote = null, isRestricted = false, restrictionReason = null) => {
  const updates = {
    status,
    approved_by_admin_id: adminId,
    approved_at: status === 'approved' ? new Date().toISOString() : null,
    rejection_note: rejectionNote || null,
    is_restricted: isRestricted || false,
    restriction_reason: restrictionReason || null,
  }
  
  // If restricting, also mark all other enrollments for this student-course pair as restricted
  if (isRestricted && restrictionReason) {
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('student_id, course_id')
      .eq('id', enrollmentId)
      .single()
    
    if (enrollment) {
      // Update all enrollments for this student-course pair
      await supabase
        .from('enrollments')
        .update({
          is_restricted: true,
          restriction_reason: restrictionReason,
        })
        .eq('student_id', enrollment.student_id)
        .eq('course_id', enrollment.course_id)
    }
  }
  
  const { data, error } = await supabase
    .from('enrollments')
    .update(updates)
    .eq('id', enrollmentId)
    .select(`
      *,
      courses (*),
      profiles:student_id (
        id,
        name
      )
    `)
    .single()
  
  if (error) throw error
  return data
}

export const getAllEnrollments = async () => {
  const { data, error } = await supabase
    .from('enrollments')
    .select(`
      *,
      courses (
        id,
        title,
        price
      ),
      profiles:student_id (
        id,
        name
      )
    `)
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data
}

export const getPendingEnrollments = async () => {
  const { data, error } = await supabase
    .from('enrollments')
    .select(`
      *,
      courses (
        id,
        title,
        price
      ),
      profiles:student_id (
        id,
        name
      )
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data
}

// Payment Proofs API
export const createPaymentProof = async (proofData) => {
  const { data, error } = await supabase
    .from('payment_proofs')
    .insert(proofData)
    .select()
    .single()
  
  if (error) throw error
  return data
}

export const getPaymentProofByEnrollment = async (enrollmentId) => {
  const { data, error } = await supabase
    .from('payment_proofs')
    .select('*')
    .eq('enrollment_id', enrollmentId)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .single()
  
  if (error && error.code !== 'PGRST116') throw error
  
  // If we have a file_url that looks like a path (not a full URL), generate a signed URL
  if (data && data.file_url && !data.file_url.startsWith('http')) {
    try {
      const { data: signedData } = await supabase.storage
        .from('payment-proofs')
        .createSignedUrl(data.file_url, 3600) // 1 hour expiry
      
      if (signedData) {
        data.file_url = signedData.signedUrl
      }
    } catch (err) {
      console.warn('Failed to generate signed URL, using path as-is:', err)
    }
  }
  
  return data
}

// Helper function to get payment proof URL (handles both public URLs and paths)
export const getPaymentProofUrl = async (fileUrl) => {
  if (!fileUrl) return null
  
  // If it's already a full URL, return it
  if (fileUrl.startsWith('http')) {
    return fileUrl
  }
  
  // Otherwise, try to generate a signed URL for private bucket
  try {
    const { data, error } = await supabase.storage
      .from('payment-proofs')
      .createSignedUrl(fileUrl, 3600) // 1 hour expiry
    
    if (error) throw error
    return data?.signedUrl || fileUrl
  } catch (err) {
    console.warn('Failed to generate signed URL:', err)
    // Fallback: try public URL (in case bucket is public)
    const { data: { publicUrl } } = supabase.storage
      .from('payment-proofs')
      .getPublicUrl(fileUrl)
    return publicUrl
  }
}

// Payout Requests API
export const createPayoutRequest = async (requestData) => {
  const { data, error } = await supabase
    .from('payout_requests')
    .insert(requestData)
    .select()
    .single()
  
  if (error) throw error
  return data
}

export const getCreatorPayoutRequests = async (creatorId) => {
  const { data, error } = await supabase
    .from('payout_requests')
    .select('*')
    .eq('creator_id', creatorId)
    .eq('status', 'approved') // Only show approved payout requests
    .order('submitted_at', { ascending: false })
  
  if (error) throw error
  return data
}

export const getAllPayoutRequests = async () => {
  const { data, error } = await supabase
    .from('payout_requests')
    .select(`
      *,
      profiles:creator_id (
        id,
        name,
        profile_slug
      )
    `)
    .order('submitted_at', { ascending: false })
  
  if (error) throw error
  return data
}

export const updatePayoutRequestStatus = async (requestId, status, adminId, adminNote = null) => {
  const updates = {
    status,
    approved_by_admin_id: adminId,
    approved_at: status === 'approved' ? new Date().toISOString() : null,
    admin_note: adminNote || null,
  }
  
  const { data, error } = await supabase
    .from('payout_requests')
    .update(updates)
    .eq('id', requestId)
    .select(`
      *,
      profiles:creator_id (
        id,
        name
      )
    `)
    .single()
  
  if (error) throw error
  return data
}

// Platform Settings API
export const getPlatformSettings = async () => {
  const { data, error } = await supabase
    .from('platform_settings')
    .select('*')
    .eq('id', 1)
    .single()
  
  if (error) throw error
  
  // Return defaults if no settings found
  if (!data) {
    return {
      platform_fee_percent: 0.1,
      payment_fee_percent: 0.02,
    }
  }
  
  return data
}

export const updatePlatformSettings = async (settings, adminId) => {
  const updates = {
    ...settings,
    updated_by: adminId,
    updated_at: new Date().toISOString(),
  }
  
  const { data, error } = await supabase
    .from('platform_settings')
    .update(updates)
    .eq('id', 1)
    .select()
    .single()
  
  if (error) throw error
  return data
}

// Earnings calculation for creators
export const getCreatorEarnings = async (creatorId) => {
  // First, get all course IDs for this creator
  const { data: creatorCourses, error: coursesError } = await supabase
    .from('courses')
    .select('id, price')
    .eq('creator_id', creatorId)
  
  if (coursesError) throw coursesError
  
  // If no courses, return zero earnings
  if (!creatorCourses || creatorCourses.length === 0) {
    return {
      totalEarnings: 0,
      platformFees: 0,
      netEarnings: 0,
      platformFeePercent: 10,
      enrollmentsCount: 0,
    }
  }
  
  const courseIds = creatorCourses.map(c => c.id)
  const coursePriceMap = {}
  creatorCourses.forEach(course => {
    coursePriceMap[course.id] = parseFloat(course.price) || 0
  })
  
  // Get all approved enrollments for creator's courses
  const { data: enrollments, error: enrollmentsError } = await supabase
    .from('enrollments')
    .select('id, course_id')
    .eq('status', 'approved')
    .in('course_id', courseIds)
  
  if (enrollmentsError) throw enrollmentsError

  // Get platform fee from settings
  let platformFeePercent = 0.1 // Default fallback
  try {
    const settings = await getPlatformSettings()
    platformFeePercent = parseFloat(settings.platform_fee_percent) || 0.1
  } catch (err) {
    console.warn('Failed to fetch platform settings, using default:', err)
  }

  let totalEarnings = 0
  let platformFees = 0

  if (enrollments && enrollments.length > 0) {
    enrollments.forEach(enrollment => {
      const coursePrice = coursePriceMap[enrollment.course_id] || 0
      const platformFee = coursePrice * platformFeePercent
      totalEarnings += coursePrice
      platformFees += platformFee
    })
  }

  const netEarnings = totalEarnings - platformFees

  return {
    totalEarnings,
    platformFees,
    netEarnings,
    platformFeePercent: platformFeePercent * 100, // Return as percentage for display
    enrollmentsCount: enrollments?.length || 0,
  }
}

// Admin: Get all courses for approval
export const getAllCoursesForAdmin = async () => {
  const { data, error } = await supabase
    .from('courses')
    .select(`
      *,
      profiles:creator_id (
        id,
        name
      )
    `)
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data
}

// Course Social Features API
export const getCourseStats = async (courseId) => {
  const [enrollments, likes, ratings, comments] = await Promise.all([
    supabase.from('enrollments').select('id', { count: 'exact', head: true }).eq('course_id', courseId).eq('status', 'approved'),
    supabase.from('course_likes').select('id', { count: 'exact', head: true }).eq('course_id', courseId),
    supabase.from('course_ratings').select('rating').eq('course_id', courseId),
    supabase.from('course_comments').select('id', { count: 'exact', head: true }).eq('course_id', courseId),
  ])
  
  const enrollmentCount = enrollments.count || 0
  const likesCount = likes.count || 0
  const commentsCount = comments.count || 0
  
  // Calculate average rating
  let averageRating = 0
  if (ratings.data && ratings.data.length > 0) {
    const sum = ratings.data.reduce((acc, r) => acc + r.rating, 0)
    averageRating = sum / ratings.data.length
  }
  
  return {
    enrollmentCount,
    likesCount,
    commentsCount,
    averageRating: parseFloat(averageRating.toFixed(1)),
    ratingsCount: ratings.data?.length || 0,
  }
}

export const getCourseComments = async (courseId) => {
  const { data, error } = await supabase
    .from('course_comments')
    .select(`
      *,
      profiles:user_id (
        id,
        name,
        profile_image_url
      )
    `)
    .eq('course_id', courseId)
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data
}

export const createCourseComment = async (courseId, userId, comment) => {
  const { data, error } = await supabase
    .from('course_comments')
    .insert({
      course_id: courseId,
      user_id: userId,
      comment,
    })
    .select(`
      *,
      profiles:user_id (
        id,
        name,
        profile_image_url
      )
    `)
    .single()
  
  if (error) throw error
  return data
}

export const deleteCourseComment = async (commentId) => {
  const { error } = await supabase
    .from('course_comments')
    .delete()
    .eq('id', commentId)
  
  if (error) throw error
}

export const toggleCourseLike = async (courseId, userId) => {
  // Check if already liked
  const { data: existing } = await supabase
    .from('course_likes')
    .select('id')
    .eq('course_id', courseId)
    .eq('user_id', userId)
    .maybeSingle()
  
  if (existing) {
    // Unlike
    const { error } = await supabase
      .from('course_likes')
      .delete()
      .eq('id', existing.id)
    
    if (error) throw error
    return { liked: false }
  } else {
    // Like
    const { error } = await supabase
      .from('course_likes')
      .insert({
        course_id: courseId,
        user_id: userId,
      })
    
    if (error) throw error
    return { liked: true }
  }
}

export const checkCourseLike = async (courseId, userId) => {
  const { data } = await supabase
    .from('course_likes')
    .select('id')
    .eq('course_id', courseId)
    .eq('user_id', userId)
    .maybeSingle()
  
  return !!data
}

export const setCourseRating = async (courseId, userId, rating) => {
  const { data, error } = await supabase
    .from('course_ratings')
    .upsert({
      course_id: courseId,
      user_id: userId,
      rating,
    }, {
      onConflict: 'course_id,user_id'
    })
    .select()
    .single()
  
  if (error) throw error
  return data
}

export const getCourseRating = async (courseId, userId) => {
  const { data } = await supabase
    .from('course_ratings')
    .select('rating')
    .eq('course_id', courseId)
    .eq('user_id', userId)
    .maybeSingle()
  
  return data?.rating || null
}

// Creator Profile API
export const getCreatorProfile = async (creatorIdOrSlug) => {
  // Check if it's a valid UUID (UUIDs have a specific format)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const isUUID = uuidRegex.test(creatorIdOrSlug)
  
  let query = supabase
    .from('profiles')
    .select('*')
    .eq('role', 'creator')
  
  if (isUUID) {
    // If it's a UUID, try by ID first, then by slug
    query = query.or(`id.eq.${creatorIdOrSlug},profile_slug.eq.${creatorIdOrSlug}`)
  } else {
    // If it's not a UUID, only search by slug
    query = query.eq('profile_slug', creatorIdOrSlug)
  }
  
  const { data, error } = await query.maybeSingle()
  
  if (error) throw error
  return data
}

export const getCreatorProfileStats = async (creatorId) => {
  // Get courses first
  const { data: courses } = await supabase
    .from('courses')
    .select('id')
    .eq('creator_id', creatorId)
    .eq('status', 'published')
  
  const coursesCount = courses?.length || 0
  const courseIds = courses?.map(c => c.id) || []
  
  // Get enrollments for creator's courses
  let enrollmentsCount = 0
  if (courseIds.length > 0) {
    const { count } = await supabase
      .from('enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'approved')
      .in('course_id', courseIds)
    enrollmentsCount = count || 0
  }
  
  // Get ratings and comments
  const [ratings, comments] = await Promise.all([
    supabase.from('creator_profile_ratings').select('rating').eq('creator_id', creatorId),
    supabase.from('creator_profile_comments').select('id', { count: 'exact', head: true }).eq('creator_id', creatorId),
  ])
  
  const commentsCount = comments.count || 0
  
  let averageRating = 0
  if (ratings.data && ratings.data.length > 0) {
    const sum = ratings.data.reduce((acc, r) => acc + r.rating, 0)
    averageRating = sum / ratings.data.length
  }
  
  return {
    coursesCount,
    enrollmentsCount,
    commentsCount,
    averageRating: parseFloat(averageRating.toFixed(1)),
    ratingsCount: ratings.data?.length || 0,
  }
}

export const getCreatorProfileComments = async (creatorId) => {
  const { data, error } = await supabase
    .from('creator_profile_comments')
    .select(`
      *,
      profiles:user_id (
        id,
        name,
        profile_image_url
      )
    `)
    .eq('creator_id', creatorId)
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data
}

export const createCreatorProfileComment = async (creatorId, userId, comment) => {
  const { data, error } = await supabase
    .from('creator_profile_comments')
    .insert({
      creator_id: creatorId,
      user_id: userId,
      comment,
    })
    .select(`
      *,
      profiles:user_id (
        id,
        name,
        profile_image_url
      )
    `)
    .single()
  
  if (error) throw error
  return data
}

export const setCreatorProfileRating = async (creatorId, userId, rating) => {
  const { data, error } = await supabase
    .from('creator_profile_ratings')
    .upsert({
      creator_id: creatorId,
      user_id: userId,
      rating,
    }, {
      onConflict: 'creator_id,user_id'
    })
    .select()
    .single()
  
  if (error) throw error
  return data
}

export const updateCreatorProfile = async (creatorId, updates) => {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', creatorId)
    .select()
    .single()
  
  if (error) throw error
  return data
}

export const getCreatorPublicCourses = async (creatorIdOrSlug) => {
  // First get the creator profile to get the ID
  const creator = await getCreatorProfile(creatorIdOrSlug)
  if (!creator) {
    return [] // Return empty array instead of throwing error
  }
  
  const { data, error } = await supabase
    .from('courses')
    .select(`
      *,
      categories:category_id (
        id,
        name,
        icon
      )
    `)
    .eq('creator_id', creator.id)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data || []
}

// Reports API
export const createReport = async (reportData) => {
  const { data, error } = await supabase
    .from('reports')
    .insert(reportData)
    .select()
    .single()
  
  if (error) throw error
  return data
}

export const getAllReports = async () => {
  const { data, error } = await supabase
    .from('reports')
    .select(`
      *,
      profiles:reporter_id (
        id,
        name
      )
    `)
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data
}

export const updateReportStatus = async (reportId, status, adminId, adminNotes = null) => {
  const updates = {
    status,
    reviewed_by_admin_id: adminId,
    reviewed_at: new Date().toISOString(),
    admin_notes: adminNotes || null,
  }
  
  const { data, error } = await supabase
    .from('reports')
    .update(updates)
    .eq('id', reportId)
    .select(`
      *,
      profiles:reporter_id (
        id,
        name
      )
    `)
    .single()
  
  if (error) throw error
  return data
}

// Categories API
export const getAllCategories = async () => {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name', { ascending: true })
  
  if (error) throw error
  
  // Organize categories into parent and subcategories
  const parentCategories = data.filter(cat => !cat.parent_id)
  const subcategories = data.filter(cat => cat.parent_id)
  
  // Attach subcategories to their parent categories
  const categoriesWithSubs = parentCategories.map(parent => ({
    ...parent,
    subcategories: subcategories.filter(sub => sub.parent_id === parent.id)
  }))
  
  return categoriesWithSubs
}

export const createCategory = async (categoryData) => {
  const { data, error } = await supabase
    .from('categories')
    .insert({
      ...categoryData,
      created_by_admin_id: categoryData.created_by_admin_id
    })
    .select()
    .single()
  
  if (error) throw error
  return data
}

export const updateCategory = async (categoryId, updates) => {
  const { data, error } = await supabase
    .from('categories')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', categoryId)
    .select()
    .single()
  
  if (error) throw error
  return data
}

export const deleteCategory = async (categoryId) => {
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', categoryId)
  
  if (error) throw error
}

// Updated getPublishedCourses to support filtering
export const getPublishedCoursesFiltered = async (filters = {}) => {
  let query = supabase
    .from('courses')
    .select(`
      *,
      profiles:creator_id (
        id,
        name,
        profile_slug,
        profile_image_url
      ),
      categories:category_id (
        id,
        name,
        icon
      )
    `)
    .eq('status', 'published')
  
  // Apply filters
  if (filters.categoryId) {
    query = query.eq('category_id', filters.categoryId)
  }
  
  if (filters.search) {
    query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
  }
  
  if (filters.level) {
    query = query.eq('level', filters.level)
  }
  
  if (filters.minPrice !== undefined) {
    query = query.gte('price', filters.minPrice)
  }
  
  if (filters.maxPrice !== undefined) {
    query = query.lte('price', filters.maxPrice)
  }
  
  // Sorting
  const sortBy = filters.sortBy || 'created_at'
  const sortOrder = filters.sortOrder || 'desc'
  query = query.order(sortBy, { ascending: sortOrder === 'asc' })
  
  const { data, error } = await query
  
  if (error) throw error
  return data
}
