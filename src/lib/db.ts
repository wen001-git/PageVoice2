import Dexie, { type EntityTable } from 'dexie'
import type { ReadingProject } from '../types'

class PageVoiceDatabase extends Dexie {
  projects!: EntityTable<ReadingProject, 'id'>

  constructor() {
    super('pagevoice2')
    this.version(1).stores({ projects: 'id, updatedAt, createdAt' })
  }
}

export const db = new PageVoiceDatabase()

export async function createProject(): Promise<ReadingProject> {
  const now = Date.now()
  const project: ReadingProject = {
    id: crypto.randomUUID(),
    title: `英文阅读 ${new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(now)}`,
    text: '',
    sentences: [],
    currentSentence: 0,
    rate: 1,
    voiceURI: '',
    repeatSentence: false,
    createdAt: now,
    updatedAt: now,
  }
  await db.projects.add(project)
  return project
}

export async function saveProject(project: ReadingProject): Promise<ReadingProject> {
  const updated = { ...project, updatedAt: Date.now() }
  await db.projects.put(updated)
  return updated
}

export async function listProjects(): Promise<ReadingProject[]> {
  return db.projects.orderBy('updatedAt').reverse().toArray()
}

export async function removeProject(id: string): Promise<void> {
  await db.projects.delete(id)
}
