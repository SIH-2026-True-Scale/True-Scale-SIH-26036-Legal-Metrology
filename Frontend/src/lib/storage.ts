import { supabase } from './supabase'

export async function uploadApplicationPhotos(
  files: FileList
): Promise<string[]> {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) throw new Error('Not authenticated')

  const paths: string[] = []

  for (const file of Array.from(files)) {
    const path = `${userId}/${crypto.randomUUID()}-${file.name}`
    const { error } = await supabase.storage
      .from('application-photos')
      .upload(path, file)

    if (error) throw new Error(`Photo upload failed: ${error.message}`)
    paths.push(path)
  }

  return paths
}