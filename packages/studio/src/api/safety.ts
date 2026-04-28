import { isSafeBookId as isSafeCoreBookId } from "@actalk/inkos-core";

/** Validates bookId for API inputs and filesystem-backed book operations. */
export function isSafeBookId(bookId: string): boolean {
  return isSafeCoreBookId(bookId);
}
