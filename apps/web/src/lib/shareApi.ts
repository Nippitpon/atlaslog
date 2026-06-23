import type { StructuredProgram } from '@atlaslog/shared'
import { supabase } from './supabase.js'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no ambiguous 0/O/1/I

function genCode(len = 6): string {
  let out = ''
  const bytes = crypto.getRandomValues(new Uint8Array(len))
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length]
  return out
}

// Publishes a copy of the program under a short code. Returns the code.
// isPublic=true also lists it in the public Discover section for everyone.
export async function createShare(program: StructuredProgram, isPublic = false): Promise<string> {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('Not signed in')

  const code = genCode()
  const { error } = await supabase.from('shared_programs').insert({
    code,
    owner_id: userData.user.id,
    name: program.name,
    program,
    is_public: isPublic,
  })
  if (error) throw new Error(error.message)
  return code
}

export interface PublicProgram {
  code: string
  name: string
  program: StructuredProgram
}

// Lists programs published as public (everyone can discover & import them)
export async function listPublicPrograms(): Promise<PublicProgram[]> {
  const { data, error } = await supabase
    .from('shared_programs')
    .select('code, name, program')
    .eq('is_public', true)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map(r => ({ code: r.code, name: r.name, program: r.program as StructuredProgram }))
}

// Fetches a shared program by code and returns a fresh copy with a new id
// ready to add to the importer's own custom programs.
export async function importShare(code: string): Promise<StructuredProgram> {
  const clean = code.trim().toUpperCase()
  const { data, error } = await supabase
    .from('shared_programs')
    .select('program')
    .eq('code', clean)
    .single()
  if (error || !data) throw new Error('Program not found for that code')

  const program = data.program as StructuredProgram
  return { ...program, id: `custom-${Date.now()}`, isCustom: true }
}
