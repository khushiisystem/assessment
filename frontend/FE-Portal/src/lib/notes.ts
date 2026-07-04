export type LearningNote = {
  id: string;
  userId: number;
  technologyId: string;
  moduleId: string;
  url: string;
  title?: string;
  addedAt: string; // ISO date string
  type?: string;
};

const STORAGE_KEY = "zec_learn_flow_notes";

const readAll = (): LearningNote[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LearningNote[]) : [];
  } catch {
    return [];
  }
};

const writeAll = (notes: LearningNote[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
};

export const getNotes = (userId: number, technologyId: string, moduleId: string): LearningNote[] => {
  return readAll().filter(n => n.userId === userId && n.technologyId === technologyId && n.moduleId === moduleId);
};

export const getAllNotesForUser = (userId: number): LearningNote[] => {
  return readAll().filter(n => n.userId === userId).sort((a, b) => b.addedAt.localeCompare(a.addedAt));
};

export const addNote = (note: Omit<LearningNote, "id" | "addedAt">): LearningNote => {
  const all = readAll();
  const newNote: LearningNote = {
    ...note,
    id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    addedAt: new Date().toISOString(),
  };
  all.push(newNote);
  writeAll(all);
  return newNote;
};

export const deleteNote = (id: string) => {
  const filtered = readAll().filter(n => n.id !== id);
  writeAll(filtered);
};

// Try to transform common Google sharing links into embeddable preview URLs
export const toEmbeddableUrl = (url: string): string => {
  try {
    const u = new URL(url);

    // Docs/Sheets/Slides forms like /document/d/{id}/, /spreadsheets/d/{id}/, /presentation/d/{id}/
    const path = u.pathname;
    const match = path.match(/\/(document|spreadsheets|presentation)\/d\/([^/]+)/);
    if (match) {
      const type = match[1];
      const id = match[2];
      if (type === "document") return `https://docs.google.com/document/d/${id}/preview`;
      if (type === "spreadsheets") return `https://docs.google.com/spreadsheets/d/${id}/preview`;
      if (type === "presentation") return `https://docs.google.com/presentation/d/${id}/preview`;
    }

    // Google Drive view links: /file/d/{id}/view
    const driveMatch = path.match(/\/file\/d\/([^/]+)/);
    if (driveMatch) {
      const id = driveMatch[1];
      return `https://drive.google.com/file/d/${id}/preview`;
    }

    // Fallback to original URL
    return url;
  } catch {
    return url;
  }
};


