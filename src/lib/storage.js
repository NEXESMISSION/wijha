import { supabase } from './supabase'

export const uploadVideo = async (file, folder = 'videos') => {
  try {
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

export const uploadThumbnail = async (file) => {
  try {
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

