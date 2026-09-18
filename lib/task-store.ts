import { normalizeAddress } from "@/lib/wallet-identity";

export type TaskSubmissionStatus = "pending" | "qualified" | "rejected";

export type TaskSubmission = {
  prollyId: string;
  wallet: string;
  response: string;
  reference: string;
  submittedAt: number;
  status: TaskSubmissionStatus;
};

const TASK_SUBMISSIONS_KEY = "prolly-task-submissions";

export function loadTaskSubmissions(): TaskSubmission[] {
  if (typeof window === "undefined") return [];

  try {
    const saved = localStorage.getItem(TASK_SUBMISSIONS_KEY);
    return saved ? (JSON.parse(saved) as TaskSubmission[]) : [];
  } catch {
    return [];
  }
}

function saveTaskSubmissions(items: TaskSubmission[]) {
  localStorage.setItem(TASK_SUBMISSIONS_KEY, JSON.stringify(items));
}

export function loadTaskSubmission(
  prollyId: string,
  wallet?: string,
): TaskSubmission | null {
  if (!wallet) return null;

  const normalizedWallet = normalizeAddress(wallet);

  return (
    loadTaskSubmissions().find(
      (item) =>
        item.prollyId === prollyId &&
        normalizeAddress(item.wallet) === normalizedWallet,
    ) ?? null
  );
}

export function saveTaskSubmission(submission: TaskSubmission) {
  const items = loadTaskSubmissions();

  const next = items.filter(
    (item) =>
      !(
        item.prollyId === submission.prollyId &&
        normalizeAddress(item.wallet) === normalizeAddress(submission.wallet)
      ),
  );

  saveTaskSubmissions([...next, submission]);
}

export function updateTaskSubmissionStatus(
  prollyId: string,
  wallet: string,
  status: TaskSubmissionStatus,
) {
  const items = loadTaskSubmissions();

  saveTaskSubmissions(
    items.map((item) =>
      item.prollyId === prollyId &&
      normalizeAddress(item.wallet) === normalizeAddress(wallet)
        ? { ...item, status }
        : item,
    ),
  );
}
