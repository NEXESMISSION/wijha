import { supabase } from './supabase'
import { validateVideoUpload } from './security'

export const uploadVideo = async (file, folder = 'videos') => {
  try {
    // Validate file before upload
    const validation = validateVideoUpload(file)
    if (!validation.valid) {
      throw new Error(validation.error)
    }
    
    const fileExt = file.name.split('.').pop()
    const fileName = `${Math.random()}.${fileExt}`
    const filePath = `${folder}/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('course-videos')
      .upload(filePath, file)

    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabase.storage
      .from('course-videos')
      .getPublicUrl(filePath)

    return publicUrl
  } catch (error) {
    console.error('Error uploading video:', error)
    throw error
  }
}

import { validateImageUpload } from './security'

export const uploadThumbnail = async (file) => {
  try {
    // Validate file before upload
    const validation = validateImageUpload(file)
    if (!validation.valid) {
      throw new Error(validation.error)
    }
    
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
    
    // Try uploading to course-videos bucket directly (no folder)
    // This is simpler and more reliable
    const { error: uploadError } = await supabase.storage
      .from('course-videos')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      // If bucket doesn't exist or upload fails, provide helpful error in Arabic
      if (uploadError.message?.includes('Bucket not found') || 
          uploadError.message?.includes('not found') ||
          uploadError.statusCode === 400 ||
          uploadError.error === 'Bucket not found') {
        throw new Error(
          'دلو التخزين "course-videos" غير موجود. ' +
          'يرجى إنشاؤه في لوحة تحكم Supabase: ' +
          'Storage > New bucket > اسم الدلو: course-videos > Public > Create bucket'
        )
      }
      throw uploadError
    }

    const { data: { publicUrl } } = supabase.storage
      .from('course-videos')
      .getPublicUrl(fileName)

    return publicUrl
  } catch (error) {
    console.error('Error uploading thumbnail:', error)
    throw error
  }
}

