export interface DiffLine {
    type: "added" | "removed" | "context" | "unchanged";
    content: string;
    oldLineNum?: number;
    newLineNum?: number;
}

export function computeDiff(original: string, modified: string): DiffLine[] {
    const originalLines = original.split('\n');
    const modifiedLines = modified.split('\n');
    const diff: DiffLine[] = [];

    let i = 0, j = 0;
    let oldLineNum = 1, newLineNum = 1;

    while (i < originalLines.length || j < modifiedLines.length) {
        if (i >= originalLines.length) {
            // Only new lines remaining
            diff.push({
                type: "added",
                content: modifiedLines[j],
                newLineNum: newLineNum++
            });
            j++;
        } else if (j >= modifiedLines.length) {
            // Only removed lines remaining
            diff.push({
                type: "removed",
                content: originalLines[i],
                oldLineNum: oldLineNum++
            });
            i++;
        } else if (originalLines[i] === modifiedLines[j]) {
            // Identity
            diff.push({
                type: "unchanged",
                content: originalLines[i],
                oldLineNum: oldLineNum++,
                newLineNum: newLineNum++
            });
            i++;
            j++;
        } else {
            // Search for best match
            let foundInMod = modifiedLines.slice(j, j + 10).indexOf(originalLines[i]);
            let foundInOrig = originalLines.slice(i, i + 10).indexOf(modifiedLines[j]);

            if (foundInMod === -1 && foundInOrig === -1) {
                // Direct replacement
                diff.push({
                    type: "removed",
                    content: originalLines[i],
                    oldLineNum: oldLineNum++
                });
                diff.push({
                    type: "added",
                    content: modifiedLines[j],
                    newLineNum: newLineNum++
                });
                i++;
                j++;
            } else if (foundInMod >= 0 && (foundInOrig === -1 || foundInMod <= foundInOrig)) {
                // Added lines before match
                for (let k = 0; k < foundInMod; k++) {
                    diff.push({
                        type: "added",
                        content: modifiedLines[j + k],
                        newLineNum: newLineNum++
                    });
                }
                j += foundInMod;
            } else {
                // Removed lines before match
                for (let k = 0; k < foundInOrig; k++) {
                    diff.push({
                        type: "removed",
                        content: originalLines[i + k],
                        oldLineNum: oldLineNum++
                    });
                }
                i += foundInOrig;
            }
        }
    }

    return diff;
}

export function getDiffSummary(diff: DiffLine[]): { added: number; removed: number } {
    const added = diff.filter(d => d.type === "added").length;
    const removed = diff.filter(d => d.type === "removed").length;
    return { added, removed };
}
