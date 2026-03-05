import ePub from 'epubjs';

export interface ExtractedChapter {
    title: string;
    text: string;
}

/**
 * Extracts all chapters and their text from an EPUB File object.
 * Runs entirely client-side.
 */
export async function extractTextFromEpub(file: File): Promise<ExtractedChapter[]> {
    const arrayBuffer = await file.arrayBuffer();
    // @ts-ignore epubjs types are sometimes finicky with array buffers
    const book = ePub(arrayBuffer);

    await book.ready;

    const chapters: ExtractedChapter[] = [];

    // book.navigation.toc contains the Table of Contents hierarchy
    // We'll flatten it to get a list of all readable chapters
    const flattenToc = (toc: any[]) => {
        let items: any[] = [];
        for (const item of toc) {
            items.push(item);
            if (item.subitems && item.subitems.length > 0) {
                items = items.concat(flattenToc(item.subitems));
            }
        }
        return items;
    };

    const tocItems = flattenToc(book.navigation.toc);

    for (const item of tocItems) {
        try {
            // Load the chapter's HTML content
            const chapter = await book.spine.get(item.href);
            if (chapter) {
                const doc = await chapter.load(book.load.bind(book));
                // Extract raw text from the DOM document, stripping HTML tags
                const text = doc.body.textContent || doc.body.innerText || '';
                if (text.trim().length > 50) { // Ignore empty or tiny chapters
                    chapters.push({
                        title: item.label.trim(),
                        text: text.trim()
                    });
                }
            }
        } catch (e) {
            console.warn(`Failed to extract text for EPUB chapter ${item.label}:`, e);
        }
    }

    return chapters;
}
