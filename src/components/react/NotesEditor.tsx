import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, Download, Loader2, RotateCcw, PenLine, Eye, FileText, ExternalLink } from 'lucide-react';
import { useAppStore } from '../../lib/store';
import { t } from '../../lib/i18n';
import { generatePdf } from '../../lib/pdf-generator';

export default function NotesEditor() {
    const { editedNotes, setEditedNotes, file, reset, locale, transcription, pdfStyle, setPdfStyle, title } = useAppStore();
    const [copied, setCopied] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [downloaded, setDownloaded] = useState(false);
    const [isStyleOpen, setIsStyleOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
    const [showTranscript, setShowTranscript] = useState(false);

    // Derived title logic: Store Title > Extracted from Content > First Header > Filename
    const derivedTitle = useMemo(() => {
        if (title) return title;

        // Try to extract from editedNotes using specific "Título" section
        // Matches: ## Título (newlines) The Title
        const explicitMatch = editedNotes.match(/^## T[íi]tulo\s*\n+([^\n]+)/m);
        if (explicitMatch) return explicitMatch[1].trim().replace(/\*\*/g, '');

        // Fallback: Check if the very first line is a Header (# or ##) that isn't a reserved section
        // Reserved sections: Resumen, Conceptos, Definiciones, Contenido
        const firstLineMatch = editedNotes.match(/^\s*#{1,2}\s+([^\n]+)/);
        if (firstLineMatch) {
            const candidate = firstLineMatch[1].trim();
            const reserved = ['Resumen', 'Conceptos', 'Definiciones', 'Contenido', 'Introducción'];
            if (!reserved.some(r => candidate.includes(r))) {
                return candidate.replace(/\*\*/g, '');
            }
        }

        return file?.name?.replace(/\.[^.]+$/, '') || 'Notes';
    }, [title, editedNotes, file]);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(showTranscript ? transcription : editedNotes);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownload = () => {
        setDownloading(true);
        setTimeout(() => {
            let finalContent = showTranscript ? transcription : editedNotes;

            // Clean content if title was extracted from it
            if (!title && !showTranscript) {
                // Logic to remove the title from the body if we just extracted it
                // 1. Try explicit remove
                let cleaned = finalContent.replace(/^## T[íi]tulo\s*\n+[^\n]+\n*/m, '');

                // 2. If no change (maybe we used the fallback first header), check if we matched the first line
                if (cleaned === finalContent) {
                    const firstLineMatch = finalContent.match(/^\s*#{1,2}\s+([^\n]+)/);
                    if (firstLineMatch) {
                        const candidate = firstLineMatch[1].trim();
                        // If this candidate matches our derivedTitle, remove it
                        if (candidate.replace(/\*\*/g, '') === derivedTitle) {
                            cleaned = finalContent.replace(/^\s*#{1,2}\s+[^\n]+\n*/, '');
                        }
                    }
                }
                finalContent = cleaned.trim();
            }

            generatePdf({
                title: derivedTitle,
                date: new Date().toLocaleDateString(locale === 'es' ? 'es-CL' : 'en-US'),
                duration: '',
                content: finalContent,
                style: pdfStyle,
            });
            setDownloading(false);
            setDownloaded(true);
            setTimeout(() => setDownloaded(false), 3000);
        }, 300);
    };

    const previewHtml = useMemo(() => {
        // Base styles
        let font = 'ui-sans-serif, system-ui, sans-serif';
        let titleColor = 'var(--text-primary)';
        let headersColor = 'var(--text-primary)';
        let borderColor = 'var(--border-subtle)';

        if (pdfStyle === 'academico') {
            font = '"Times New Roman", Times, serif';
            titleColor = '#003366'; // Classic Blue
            headersColor = '#003366';
        } else if (pdfStyle === 'minimalista') {
            font = 'Helvetica, Arial, sans-serif';
            titleColor = '#000000'; // Black (Darker)
            headersColor = '#111';
        }

        // Apply style to container via wrapper in render, but here we format HTML
        // tailored slightly to the vibe.

        // Remove Title section from preview body if we are showing it as Main Title
        let contentToRender = editedNotes.replace(/^## T[íi]tulo\s*\n+[^\n]+\n*/m, '').trim();

        // Also remove first line if it matches derivedTitle (fallback case)
        if (contentToRender === editedNotes.trim()) {
            const firstLineMatch = editedNotes.match(/^\s*#{1,2}\s+([^\n]+)/);
            if (firstLineMatch && firstLineMatch[1].trim().replace(/\*\*/g, '') === derivedTitle) {
                contentToRender = editedNotes.replace(/^\s*#{1,2}\s+[^\n]+\n*/, '').trim();
            }
        }

        let html = contentToRender
            .replace(/^### (.+)$/gm, `<h3 style="font-family:${font};font-size:1rem;font-weight:600;margin:1.25rem 0 0.5rem;color:${headersColor};">$1</h3>`)
            .replace(/^## (.+)$/gm, `<h2 style="font-family:${font};font-size:1.15rem;font-weight:600;margin:1.5rem 0 0.5rem;color:${titleColor};border-bottom:${pdfStyle === 'academico' ? '1px solid #003366' : 'none'};padding-bottom:4px;">$1</h2>`)
            .replace(/^# (.+)$/gm, `<h1 style="font-family:${font};font-size:1.3rem;font-weight:700;margin:1.75rem 0 0.5rem;color:${titleColor};">$1</h1>`)
            .replace(/\*\*(.+?)\*\*/g, `<strong style="color:var(--text-primary);font-weight:600;">$1</strong>`)
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/^- (.+)$/gm, '<li style="margin:0.25rem 0;padding-left:0.25rem;">$1</li>')
            .replace(/(<li.*<\/li>\n?)+/g, '<ul style="list-style:disc;padding-left:1.25rem;margin:0.5rem 0;">$&</ul>')
            .replace(/\n\n/g, '<br/><br/>')
            .replace(/\n/g, '<br/>');

        // Add Title logic
        if (!editedNotes.startsWith('# ')) {
            html = `<h1 style="font-family:${font};font-size:1.5rem;font-weight:bold;margin-bottom:1rem;color:${titleColor};">${derivedTitle}</h1>` + html;
        }

        return html;
    }, [editedNotes, pdfStyle, derivedTitle]);

    return (
        <div className="flex flex-col h-full rounded-xl overflow-hidden" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
            {/* Toolbar */}
            <div className="flex items-center justify-between px-3 py-2 sm:px-4 sm:py-2.5 bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)] overflow-x-auto sm:overflow-visible custom-scrollbar gap-2">

                {/* Left Group: Tabs & Title */}
                <div className="flex items-center gap-3 min-w-0">
                    {/* Tabs (mobile) */}
                    <div className="flex items-center gap-1 sm:hidden flex-shrink-0">
                        <button
                            onClick={() => setActiveTab('edit')}
                            className="flex items-center gap-1.5 p-2 rounded-md transition-colors"
                            style={{
                                background: activeTab === 'edit' && !showTranscript ? 'var(--bg-tertiary)' : 'transparent',
                                color: activeTab === 'edit' ? 'var(--text-primary)' : 'var(--text-muted)',
                            }}
                            title={t('app.editor.markdown', locale)}
                        >
                            <PenLine size={16} />
                        </button>
                        <button
                            onClick={() => setActiveTab('preview')}
                            className="flex items-center gap-1.5 p-2 rounded-md transition-colors"
                            style={{
                                background: activeTab === 'preview' && !showTranscript ? 'var(--bg-tertiary)' : 'transparent',
                                color: activeTab === 'preview' ? 'var(--text-primary)' : 'var(--text-muted)',
                            }}
                            title={t('app.editor.preview', locale)}
                        >
                            <Eye size={16} />
                        </button>
                    </div>

                    {/* Title Display */}
                    <div className="hidden sm:block min-w-0">
                        <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)', maxWidth: '200px' }}>
                            {title || file?.name?.replace(/\.[^.]+$/, '') || t('app.editor.markdown', locale)}
                        </h3>
                    </div>
                </div>

                {/* Right Group: Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                        onClick={() => setShowTranscript(!showTranscript)}
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md transition-colors whitespace-nowrap"
                        style={{
                            background: showTranscript ? 'var(--accent-subtle)' : 'transparent',
                            color: showTranscript ? 'var(--accent)' : 'var(--text-muted)',
                            border: `1px solid ${showTranscript ? 'var(--accent)' : 'var(--border-subtle)'}`
                        }}
                        title={locale === 'es' ? 'Ver transcripción original' : 'View original transcript'}
                    >
                        <FileText size={14} />
                        <span className="hidden md:inline">{locale === 'es' ? 'Transcripción' : 'Transcript'}</span>
                    </button>

                    <div className="w-px h-4 mx-1 hidden sm:block" style={{ background: 'var(--border-subtle)' }}></div>

                    <button
                        onClick={reset}
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md transition-colors whitespace-nowrap"
                        style={{ color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}
                        title={t('app.editor.new', locale)}
                    >
                        <RotateCcw size={14} />
                        <span className="hidden md:inline">{t('app.editor.new', locale)}</span>
                    </button>

                    <button
                        onClick={handleCopy}
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md transition-colors whitespace-nowrap"
                        style={{
                            color: copied ? '#34d399' : 'var(--text-muted)',
                            border: `1px solid ${copied ? 'rgba(16,185,129,0.3)' : 'var(--border-subtle)'}`,
                        }}
                        title={t('app.editor.copy', locale)}
                    >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                        <span className="hidden md:inline">{copied ? t('app.editor.copied', locale) : t('app.editor.copy', locale)}</span>
                    </button>

                    {/* Style Selector (Custom Dropdown) */}
                    <div className="relative">
                        <button
                            onClick={() => setIsStyleOpen(!isStyleOpen)}
                            className="flex items-center gap-1.5 p-2 sm:px-2.5 sm:py-1.5 rounded-md border border-[var(--border-subtle)] hover:bg-[var(--bg-tertiary)] transition-colors whitespace-nowrap"
                            style={{ color: 'var(--text-secondary)' }}
                            title={t('app.config.pdfstyle', locale)}
                        >
                            <span className="capitalize hidden sm:inline text-xs font-medium">{t(`app.style.${pdfStyle}` as any, locale)}</span>
                            <div style={{ color: 'var(--text-muted)' }}>
                                <PenLine size={16} className="sm:hidden" />
                                <svg className="hidden sm:block" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                            </div>
                        </button>

                        {isStyleOpen && (
                            <>
                                <div
                                    className="fixed inset-0 z-40 bg-black/20 sm:bg-transparent backdrop-blur-[1px] sm:backdrop-blur-none"
                                    onClick={() => setIsStyleOpen(false)}
                                />
                                <div
                                    className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] max-w-xs sm:absolute sm:top-full sm:right-0 sm:left-auto sm:translate-x-0 sm:translate-y-1 sm:w-36 p-1 rounded-lg shadow-2xl border border-[var(--border-subtle)] overflow-hidden z-50 flex flex-col"
                                    style={{ background: 'var(--bg-secondary)' }}
                                >
                                    <div className="px-3 py-2 text-xs font-semibold text-[var(--text-muted)] border-b border-[var(--border-subtle)] mb-1 sm:hidden">
                                        {t('app.config.pdfstyle', locale)}
                                    </div>
                                    {(['minimalista', 'academico', 'cornell'] as const).map((style) => (
                                        <button
                                            key={style}
                                            onClick={() => {
                                                setPdfStyle(style);
                                                setIsStyleOpen(false);
                                            }}
                                            className="text-left px-3 py-3 sm:py-2 text-sm sm:text-xs font-medium rounded-md transition-colors flex items-center justify-between"
                                            style={{
                                                color: pdfStyle === style ? 'var(--accent)' : 'var(--text-primary)',
                                                background: pdfStyle === style ? 'var(--accent-subtle)' : 'transparent',
                                            }}
                                        >
                                            {t(`app.style.${style}` as any, locale)}
                                            {pdfStyle === style && <Check size={16} className="sm:w-3 sm:h-3" />}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    <div className="w-px h-4 mx-1 hidden sm:block" style={{ background: 'var(--border-subtle)' }}></div>

                    {/* View PDF Button */}
                    <button
                        onClick={() => {
                            let finalContent = showTranscript ? transcription : editedNotes;
                            if (!title && !showTranscript) {
                                finalContent = finalContent.replace(/^## T[íi]tulo\s*\n+[^\n]+\n*/m, '').trim();
                                if (finalContent === editedNotes.trim()) {
                                    const firstLineMatch = editedNotes.match(/^\s*#{1,2}\s+([^\n]+)/);
                                    if (firstLineMatch && firstLineMatch[1].trim().replace(/\*\*/g, '') === derivedTitle) {
                                        finalContent = editedNotes.replace(/^\s*#{1,2}\s+[^\n]+\n*/, '').trim();
                                    }
                                }
                            }
                            const url = generatePdf({
                                title: derivedTitle,
                                date: new Date().toLocaleDateString(locale === 'es' ? 'es-CL' : 'en-US'),
                                duration: '',
                                content: finalContent,
                                style: pdfStyle,
                            }, 'blob');
                            if (url && typeof url === 'string') window.open(url, '_blank');
                        }}
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md transition-colors whitespace-nowrap"
                        style={{ color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                        title={locale === 'es' ? 'Ver PDF' : 'View PDF'}
                    >
                        <ExternalLink size={14} />
                        <span className="hidden md:inline">PDF</span>
                    </button>

                    <button
                        onClick={handleDownload}
                        disabled={downloading}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-medium text-white transition-colors whitespace-nowrap"
                        style={{ background: downloaded ? '#10b981' : 'var(--accent)' }}
                    >
                        {downloading ? <Loader2 size={14} className="animate-spin" /> : downloaded ? <Check size={14} /> : <Download size={14} />}
                        <span className="hidden sm:inline">
                            {downloading ? t('app.editor.downloading', locale) : downloaded ? t('app.editor.downloaded', locale) : t('app.editor.download', locale)}
                        </span>
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex min-h-0 relative">
                {showTranscript ? (
                    <div className="absolute inset-0 p-4 sm:p-5 overflow-auto custom-scrollbar">
                        <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                            {transcription}
                        </pre>
                    </div>
                ) : (
                    <>
                        {/* Markdown Editor */}
                        <div className={`flex-1 min-h-0 ${activeTab !== 'edit' ? 'hidden sm:block' : ''}`}>
                            <textarea
                                value={editedNotes}
                                onChange={(e) => setEditedNotes(e.target.value)}
                                className="w-full h-full resize-none bg-transparent p-4 sm:p-5 text-sm font-mono outline-none custom-scrollbar"
                                style={{ color: 'var(--text-primary)', lineHeight: 1.7 }}
                                spellCheck={false}
                            />
                        </div>

                        {/* Divider */}
                        <div className="hidden sm:block w-px" style={{ background: 'var(--border-subtle)' }}></div>

                        {/* Preview */}
                        <div className={`flex-1 min-h-0 overflow-auto custom-scrollbar p-4 sm:p-5 ${activeTab !== 'preview' ? 'hidden sm:block' : ''}`}>
                            <div
                                className="text-sm leading-relaxed max-w-none"
                                style={{ color: 'var(--text-secondary)' }}
                                dangerouslySetInnerHTML={{ __html: previewHtml }}
                            />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
