/**
 * 3D Viewer - Application UI Controller
 * Handles all UI interactions, panels, dialogs, and connects to the ViewerEngine.
 */

/* ========================================================================
   SVG Icon Definitions
   ======================================================================== */
const SVG = {
    folder: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
    link: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
    github: `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>`,
    info: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
    cube: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
    wireframe: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7v10l10 5 10-5V7L12 2z"/><path d="M12 22V12"/><path d="M2 7l10 5"/><path d="M22 7l-10 5"/><path d="M7 4.5L17 9.5"/><path d="M7 19.5L17 14.5"/></svg>`,
    textured: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
    fitView: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>`,
    camera: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
    eye: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
    eyeOff: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`,
    gear: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    tree: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="8" height="6" rx="1"/><rect x="14" y="9" width="8" height="6" rx="1"/><rect x="14" y="17" width="8" height="5" rx="1"/><path d="M6 8v3a1 1 0 0 0 1 1h7"/><path d="M6 11v8a1 1 0 0 0 1 1h7"/></svg>`,
    arrowRight: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`,
    arrowDown: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`,
    perspective: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5l14 0l3 14l-20 0z"/><path d="M5 5l3 14"/><path d="M19 5l-3 14"/></svg>`,
    ortho: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="12" y1="4" x2="12" y2="20"/></svg>`,
    grid: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>`,
    axis: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="20" x2="4" y2="4"/><line x1="4" y1="20" x2="20" y2="20"/><line x1="4" y1="20" x2="10" y2="14"/><polyline points="4 8 4 4"/><polyline points="16 20 20 20"/><text x="2" y="4" font-size="5" fill="currentColor" stroke="none">Y</text><text x="20" y="22" font-size="5" fill="currentColor" stroke="none">X</text><text x="10" y="13" font-size="5" fill="currentColor" stroke="none">Z</text></svg>`,
    measure: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0z"/><line x1="7" y1="14" x2="10" y2="11"/><line x1="11" y1="18" x2="14" y2="15"/></svg>`,
    flip: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`,
    mesh: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>`,
    file: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>`,
    close: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    dropdown: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`,
    panelLeft: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>`,
    panelRight: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="15" y1="3" x2="15" y2="21"/></svg>`,
    share: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`,
    download: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
};

/* ========================================================================
   Utility Functions
   ======================================================================== */
function el(tag, attrs = {}, ...children) {
    const elem = document.createElement(tag);
    for (const [key, val] of Object.entries(attrs)) {
        if (key === 'className') {
            elem.className = val;
        } else if (key === 'style' && typeof val === 'object') {
            Object.assign(elem.style, val);
        } else if (key.startsWith('on') && typeof val === 'function') {
            elem.addEventListener(key.slice(2).toLowerCase(), val);
        } else if (key === 'innerHTML') {
            elem.innerHTML = val;
        } else if (key === 'dataset') {
            for (const [dk, dv] of Object.entries(val)) {
                elem.dataset[dk] = dv;
            }
        } else {
            elem.setAttribute(key, val);
        }
    }
    for (const child of children) {
        if (typeof child === 'string') {
            elem.appendChild(document.createTextNode(child));
        } else if (child instanceof Node) {
            elem.appendChild(child);
        }
    }
    return elem;
}

function qs(sel, parent = document) { return parent.querySelector(sel); }
function qsa(sel, parent = document) { return parent.querySelectorAll(sel); }

/* ========================================================================
   Tooltip Manager
   ======================================================================== */
class TooltipManager {
    constructor() {
        this.tooltip = el('div', { className: 'tooltip' });
        document.body.appendChild(this.tooltip);
        this._hideTimer = null;
    }
    attach(element, text) {
        element.addEventListener('mouseenter', (e) => {
            clearTimeout(this._hideTimer);
            this.tooltip.textContent = text;
            this.tooltip.classList.add('visible');
            const rect = element.getBoundingClientRect();
            this.tooltip.style.left = rect.left + rect.width / 2 + 'px';
            this.tooltip.style.top = rect.bottom + 6 + 'px';
        });
        element.addEventListener('mouseleave', () => {
            this._hideTimer = setTimeout(() => {
                this.tooltip.classList.remove('visible');
            }, 100);
        });
    }
}

/* ========================================================================
   Dialog Manager
   ======================================================================== */
class DialogManager {
    constructor() {
        this.overlay = el('div', { className: 'dialog_overlay' });
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.close();
        });
        document.body.appendChild(this.overlay);
    }

    open(contentEl) {
        this.overlay.innerHTML = '';
        this.overlay.appendChild(contentEl);
        this.overlay.classList.add('visible');
        this._escHandler = (e) => {
            if (e.key === 'Escape') this.close();
        };
        document.addEventListener('keydown', this._escHandler);
    }

    close() {
        this.overlay.classList.remove('visible');
        document.removeEventListener('keydown', this._escHandler);
    }

    /* Open URL Dialog */
    showOpenURLDialog(onSubmit) {
        const dialog = el('div', { className: 'dialog' },
            el('div', { className: 'dialog_header' },
                el('span', {}, 'Open URL'),
                el('button', { className: 'dialog_close', innerHTML: SVG.close, onClick: () => this.close() })
            ),
            el('div', { className: 'dialog_body' },
                el('p', {}, 'Enter the URL of a 3D model file:'),
                el('input', { type: 'text', className: 'dialog_input', id: 'url_input', placeholder: 'https://example.com/model.glb' })
            ),
            el('div', { className: 'dialog_footer' },
                el('button', { className: 'dialog_btn dialog_btn_secondary', onClick: () => this.close() }, 'Cancel'),
                el('button', { className: 'dialog_btn dialog_btn_primary', onClick: () => {
                    const url = qs('#url_input').value.trim();
                    if (url) {
                        onSubmit(url);
                        this.close();
                    }
                }}, 'OK')
            )
        );
        this.open(dialog);
        setTimeout(() => qs('#url_input').focus(), 50);
    }

    /* About Dialog */
    showAboutDialog() {
        const dialog = el('div', { className: 'dialog' },
            el('div', { className: 'dialog_header' },
                el('span', {}, 'About 3D Viewer'),
                el('button', { className: 'dialog_close', innerHTML: SVG.close, onClick: () => this.close() })
            ),
            el('div', { className: 'dialog_body about_body' },
                el('div', { className: 'about_logo' }, el('span', { innerHTML: SVG.cube })),
                el('h2', {}, '3D Viewer'),
                el('p', { className: 'about_version' }, 'Version 1.0.0'),
                el('p', {}, 'A free, open-source online 3D model viewer. Supports OBJ, STL, GLTF, GLB, FBX, 3DS, PLY, and many more formats.'),
                el('hr'),
                el('p', { className: 'about_credits' }, 'Built with Three.js'),
                el('p', { className: 'about_link' },
                    el('a', { href: 'https://github.com', target: '_blank' }, 'View on GitHub')
                )
            ),
            el('div', { className: 'dialog_footer' },
                el('button', { className: 'dialog_btn dialog_btn_primary', onClick: () => this.close() }, 'Close')
            )
        );
        this.open(dialog);
    }

    /* Share / Embed Dialog */
    showShareDialog(modelUrl) {
        const shareUrl = modelUrl ? `${window.location.origin}${window.location.pathname}#model=${encodeURIComponent(modelUrl)}` : window.location.href;
        const embedCode = `<iframe src="${shareUrl}" width="800" height="600" frameborder="0"></iframe>`;
        const dialog = el('div', { className: 'dialog dialog_wide' },
            el('div', { className: 'dialog_header' },
                el('span', {}, 'Share / Embed'),
                el('button', { className: 'dialog_close', innerHTML: SVG.close, onClick: () => this.close() })
            ),
            el('div', { className: 'dialog_body' },
                el('label', { className: 'dialog_label' }, 'Shareable Link:'),
                el('div', { className: 'dialog_input_group' },
                    el('input', { type: 'text', className: 'dialog_input', id: 'share_url_input', value: shareUrl, readOnly: true }),
                    el('button', { className: 'dialog_btn dialog_btn_secondary', onClick: () => {
                        const inp = qs('#share_url_input');
                        inp.select();
                        navigator.clipboard.writeText(inp.value);
                    }}, 'Copy')
                ),
                el('label', { className: 'dialog_label', style: { marginTop: '12px' } }, 'Embed Code:'),
                el('div', { className: 'dialog_input_group' },
                    el('input', { type: 'text', className: 'dialog_input', id: 'embed_input', value: embedCode, readOnly: true }),
                    el('button', { className: 'dialog_btn dialog_btn_secondary', onClick: () => {
                        const inp = qs('#embed_input');
                        inp.select();
                        navigator.clipboard.writeText(inp.value);
                    }}, 'Copy')
                )
            ),
            el('div', { className: 'dialog_footer' },
                el('button', { className: 'dialog_btn dialog_btn_primary', onClick: () => this.close() }, 'Close')
            )
        );
        this.open(dialog);
    }
}

/* ========================================================================
   Context Menu
   ======================================================================== */
class ContextMenu {
    constructor() {
        this.menu = el('div', { className: 'context_menu' });
        document.body.appendChild(this.menu);
        document.addEventListener('click', () => this.hide());
        document.addEventListener('contextmenu', () => this.hide());
    }

    show(x, y, items) {
        this.menu.innerHTML = '';
        for (const item of items) {
            if (item.separator) {
                this.menu.appendChild(el('div', { className: 'context_menu_separator' }));
            } else {
                const row = el('div', { className: 'context_menu_item', onClick: (e) => {
                    e.stopPropagation();
                    item.action();
                    this.hide();
                }}, item.label);
                this.menu.appendChild(row);
            }
        }
        this.menu.style.left = x + 'px';
        this.menu.style.top = y + 'px';
        this.menu.classList.add('visible');
        // Clamp inside viewport
        const rect = this.menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            this.menu.style.left = (window.innerWidth - rect.width - 4) + 'px';
        }
        if (rect.bottom > window.innerHeight) {
            this.menu.style.top = (window.innerHeight - rect.height - 4) + 'px';
        }
    }

    hide() {
        this.menu.classList.remove('visible');
    }
}

/* ========================================================================
   Toast / Snackbar
   ======================================================================== */
class Toast {
    constructor() {
        this.container = el('div', { className: 'toast_container' });
        document.body.appendChild(this.container);
    }
    show(message, duration = 3000) {
        const t = el('div', { className: 'toast' }, message);
        this.container.appendChild(t);
        requestAnimationFrame(() => t.classList.add('visible'));
        setTimeout(() => {
            t.classList.remove('visible');
            setTimeout(() => t.remove(), 300);
        }, duration);
    }
}

/* ========================================================================
   Progress Bar
   ======================================================================== */
class ProgressBar {
    constructor(container) {
        this.el = el('div', { className: 'progress_bar' },
            this.fill = el('div', { className: 'progress_bar_fill' })
        );
        container.prepend(this.el);
    }
    show() { this.el.classList.add('visible'); }
    hide() {
        this.el.classList.remove('visible');
        this.fill.style.width = '0%';
    }
    setProgress(pct) {
        this.fill.style.width = Math.min(100, Math.max(0, pct)) + '%';
    }
}

/* ========================================================================
   Navigator Panel (Left)
   ======================================================================== */
class NavigatorPanel {
    constructor(container, app) {
        this.app = app;
        this.container = container;
        this.activeTab = 'files';
        this.treeData = [];
        this.fileList = [];
        this.collapsed = false;
        this._savedWidth = null;
        this.build();
    }

    build() {
        this.container.innerHTML = '';
        // Tab bar
        this.tabBar = el('div', { className: 'panel_tabs' },
            this.filesTab = el('div', { className: 'panel_tab active', dataset: { tab: 'files' }, onClick: () => this.switchTab('files') },
                el('span', { innerHTML: SVG.file }), el('span', {}, 'Files')
            ),
            this.treeTab = el('div', { className: 'panel_tab', dataset: { tab: 'tree' }, onClick: () => this.switchTab('tree') },
                el('span', { innerHTML: SVG.tree }), el('span', {}, 'Model')
            )
        );
        this.filesContent = el('div', { className: 'panel_content active', dataset: { panel: 'files' } },
            el('div', { className: 'panel_empty_text' }, 'No files loaded.')
        );
        this.treeContent = el('div', { className: 'panel_content', dataset: { panel: 'tree' } },
            el('div', { className: 'panel_empty_text' }, 'No model loaded.')
        );
        this.container.appendChild(this.tabBar);
        this.container.appendChild(this.filesContent);
        this.container.appendChild(this.treeContent);
    }

    switchTab(tab) {
        this.activeTab = tab;
        qsa('.panel_tab', this.container).forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
        qsa('.panel_content', this.container).forEach(c => c.classList.toggle('active', c.dataset.panel === tab));
    }

    setFiles(files) {
        this.fileList = files;
        this.filesContent.innerHTML = '';
        if (!files.length) {
            this.filesContent.innerHTML = '<div class="panel_empty_text">No files loaded.</div>';
            return;
        }
        const list = el('div', { className: 'file_list' });
        for (const f of files) {
            const item = el('div', { className: 'file_list_item' },
                el('span', { className: 'file_list_icon', innerHTML: SVG.file }),
                el('span', { className: 'file_list_name' }, f.name || f),
            );
            list.appendChild(item);
        }
        this.filesContent.appendChild(list);
    }

    setModelTree(sceneGraph) {
        this.treeContent.innerHTML = '';
        if (!sceneGraph || !sceneGraph.children || sceneGraph.children.length === 0) {
            this.treeContent.innerHTML = '<div class="panel_empty_text">No model loaded.</div>';
            return;
        }
        const treeRoot = el('div', { className: 'model_tree' });
        this._buildTreeNode(sceneGraph, treeRoot, 0);
        this.treeContent.appendChild(treeRoot);
    }

    _buildTreeNode(node, parentEl, depth) {
        const hasChildren = node.children && node.children.length > 0;
        const isMesh = node.type === 'Mesh' || node.type === 'SkinnedMesh' || node.type === 'LineSegments' || node.type === 'Points';

        const row = el('div', { className: 'tree_row', style: { paddingLeft: (depth * 16 + 4) + 'px' } });
        row.dataset.uuid = node.uuid || '';

        // Expand/collapse arrow
        const arrow = el('span', { className: 'tree_arrow' + (hasChildren ? '' : ' invisible'), innerHTML: SVG.arrowRight });
        let expanded = true;
        if (hasChildren) {
            arrow.innerHTML = SVG.arrowDown;
            arrow.addEventListener('click', (e) => {
                e.stopPropagation();
                expanded = !expanded;
                arrow.innerHTML = expanded ? SVG.arrowDown : SVG.arrowRight;
                childContainer.style.display = expanded ? '' : 'none';
            });
        }
        row.appendChild(arrow);

        // Icon
        const icon = el('span', { className: 'tree_icon', innerHTML: isMesh ? SVG.mesh : SVG.cube });
        row.appendChild(icon);

        // Name
        const name = el('span', { className: 'tree_name' }, node.name || node.type || 'Object');
        row.appendChild(name);

        // Visibility toggle
        const vis = el('span', { className: 'tree_visibility', innerHTML: SVG.eye });
        let visible = true;
        vis.addEventListener('click', (e) => {
            e.stopPropagation();
            visible = !visible;
            vis.innerHTML = visible ? SVG.eye : SVG.eyeOff;
            vis.classList.toggle('off', !visible);
            if (this.app.engine && node.uuid) {
                const obj = this.app.engine.getObjectByUuid(node.uuid);
                if (obj) obj.visible = visible;
            }
        });
        row.appendChild(vis);

        // Click row to select
        row.addEventListener('click', () => {
            qsa('.tree_row', this.treeContent).forEach(r => r.classList.remove('selected'));
            row.classList.add('selected');
            if (this.app.engine && node.uuid) {
                const obj = this.app.engine.getObjectByUuid(node.uuid);
                if (obj && obj.isMesh) this.app.engine.selectMesh(obj);
                this.app.sidebar.showMeshDetails(node);
            }
        });

        parentEl.appendChild(row);

        // Children
        const childContainer = el('div', { className: 'tree_children' });
        if (hasChildren) {
            for (const child of node.children) {
                this._buildTreeNode(child, childContainer, depth + 1);
            }
        }
        parentEl.appendChild(childContainer);
    }

    toggle() {
        this.collapsed = !this.collapsed;
        if (this.collapsed) {
            this._savedWidth = this.container.style.width || this.container.offsetWidth + 'px';
            this.container.style.width = '0px';
            this.container.style.minWidth = '0px';
            this.container.style.overflow = 'hidden';
        } else {
            this.container.style.width = this._savedWidth || '260px';
            this.container.style.minWidth = '';
            this.container.style.overflow = '';
        }
        this.container.classList.toggle('collapsed', this.collapsed);
        if (this.app.engine) this.app.engine.resize();
    }
}

/* ========================================================================
   Sidebar Panel (Right)
   ======================================================================== */
class SidebarPanel {
    constructor(container, app) {
        this.app = app;
        this.container = container;
        this.activeTab = 'details';
        this.collapsed = false;
        this._savedWidth = null;
        this.settings = {
            bgColor: '#3a3a3a',
            defaultColor: '#cccccc',
            showEdges: false,
            showGrid: true,
            showAxes: true,
            theme: 'dark',
        };
        this.build();
    }

    build() {
        this.container.innerHTML = '';
        this.tabBar = el('div', { className: 'panel_tabs' },
            this.detailsTab = el('div', { className: 'panel_tab active', dataset: { tab: 'details' }, onClick: () => this.switchTab('details') },
                el('span', { innerHTML: SVG.info }), el('span', {}, 'Details')
            ),
            this.settingsTab = el('div', { className: 'panel_tab', dataset: { tab: 'settings' }, onClick: () => this.switchTab('settings') },
                el('span', { innerHTML: SVG.gear }), el('span', {}, 'Settings')
            )
        );
        this.detailsContent = el('div', { className: 'panel_content active', dataset: { panel: 'details' } },
            el('div', { className: 'panel_empty_text' }, 'Select an object to see details.')
        );
        this.settingsContent = this._buildSettings();
        this.container.appendChild(this.tabBar);
        this.container.appendChild(this.detailsContent);
        this.container.appendChild(this.settingsContent);
    }

    switchTab(tab) {
        this.activeTab = tab;
        qsa('.panel_tab', this.container).forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
        qsa('.panel_content', this.container).forEach(c => c.classList.toggle('active', c.dataset.panel === tab));
    }

    _buildSettings() {
        const self = this;
        const section = (title, ...children) => {
            const s = el('div', { className: 'settings_section' },
                el('div', { className: 'settings_section_title' }, title),
                ...children
            );
            return s;
        };
        const colorRow = (label, value, onChange) => {
            const input = el('input', { type: 'color', value: value, className: 'settings_color' });
            input.addEventListener('input', (e) => onChange(e.target.value));
            return el('div', { className: 'settings_row' },
                el('span', { className: 'settings_label' }, label),
                input
            );
        };
        const toggleRow = (label, checked, onChange) => {
            const input = el('input', { type: 'checkbox', className: 'settings_toggle' });
            input.checked = checked;
            input.addEventListener('change', (e) => onChange(e.target.checked));
            return el('div', { className: 'settings_row' },
                el('span', { className: 'settings_label' }, label),
                el('label', { className: 'toggle_switch' },
                    input,
                    el('span', { className: 'toggle_slider' })
                )
            );
        };

        const content = el('div', { className: 'panel_content', dataset: { panel: 'settings' } },
            section('Appearance',
                colorRow('Background Color', this.settings.bgColor, (v) => {
                    self.settings.bgColor = v;
                    if (self.app.engine) self.app.engine.setBackgroundColor(v);
                }),
                colorRow('Default Color', this.settings.defaultColor, (v) => {
                    self.settings.defaultColor = v;
                    if (self.app.engine) self.app.engine.setDefaultMaterialColor(v);
                })
            ),
            section('Display',
                toggleRow('Show Edges', this.settings.showEdges, (v) => {
                    self.settings.showEdges = v;
                    if (self.app.engine) self.app.engine.toggleEdges(v);
                }),
                toggleRow('Show Grid', this.settings.showGrid, (v) => {
                    self.settings.showGrid = v;
                    if (self.app.engine) self.app.engine.toggleGrid(v);
                }),
                toggleRow('Show Axes', this.settings.showAxes, (v) => {
                    self.settings.showAxes = v;
                    if (self.app.engine) self.app.engine.toggleAxes(v);
                })
            ),
            section('Theme',
                toggleRow('Dark Theme', this.settings.theme === 'dark', (v) => {
                    self.settings.theme = v ? 'dark' : 'light';
                    document.body.classList.toggle('light_theme', !v);
                    if (self.app.engine) {
                        const bgc = v ? '#3a3a3a' : '#e0e0e0';
                        self.settings.bgColor = bgc;
                        self.app.engine.setBackgroundColor(bgc);
                    }
                })
            )
        );
        return content;
    }

    showMeshDetails(node) {
        this.detailsContent.innerHTML = '';
        if (!node) {
            this.detailsContent.innerHTML = '<div class="panel_empty_text">Select an object to see details.</div>';
            return;
        }
        const info = el('div', { className: 'details_panel' });
        const addRow = (label, value) => {
            info.appendChild(el('div', { className: 'details_row' },
                el('span', { className: 'details_label' }, label),
                el('span', { className: 'details_value' }, String(value ?? '—'))
            ));
        };
        info.appendChild(el('div', { className: 'details_title' }, node.name || node.type || 'Object'));
        addRow('Type', node.type || '—');
        addRow('UUID', node.uuid ? node.uuid.substring(0, 8) + '...' : '—');

        if (node.geometry) {
            const geo = node.geometry;
            addRow('Vertices', geo.attributes && geo.attributes.position ? geo.attributes.position.count : (geo.vertexCount ?? '—'));
            addRow('Faces', geo.index ? geo.index.count / 3 : (geo.faceCount ?? '—'));
        } else {
            addRow('Vertices', node.vertexCount ?? '—');
            addRow('Faces', node.faceCount ?? '—');
        }

        if (node.material) {
            const mat = node.material;
            info.appendChild(el('div', { className: 'details_subtitle' }, 'Material'));
            addRow('Name', mat.name || '(default)');
            addRow('Type', mat.type || '—');
            if (mat.color) {
                const c = typeof mat.color === 'string' ? mat.color : `#${mat.color.getHexString ? mat.color.getHexString() : 'cccccc'}`;
                const colorSwatch = el('span', { className: 'details_color_swatch', style: { background: c } });
                const row = el('div', { className: 'details_row' },
                    el('span', { className: 'details_label' }, 'Color'),
                    el('span', { className: 'details_value' }, c, colorSwatch)
                );
                info.appendChild(row);
            }
        }

        this.detailsContent.appendChild(info);
        this.switchTab('details');
    }

    toggle() {
        this.collapsed = !this.collapsed;
        if (this.collapsed) {
            this._savedWidth = this.container.style.width || this.container.offsetWidth + 'px';
            this.container.style.width = '0px';
            this.container.style.minWidth = '0px';
            this.container.style.overflow = 'hidden';
        } else {
            this.container.style.width = this._savedWidth || '280px';
            this.container.style.minWidth = '';
            this.container.style.overflow = '';
        }
        this.container.classList.toggle('collapsed', this.collapsed);
        if (this.app.engine) this.app.engine.resize();
    }
}

/* ========================================================================
   Splitter (Draggable Divider)
   ======================================================================== */
class Splitter {
    constructor(element, target, side, app) {
        this.el = element;
        this.target = target;
        this.side = side; // 'left' or 'right'
        this.app = app;
        this._dragging = false;
        this._startX = 0;
        this._startW = 0;

        this.el.addEventListener('mousedown', (e) => this._onMouseDown(e));
        this.el.addEventListener('dblclick', () => this._onDblClick());
    }

    _onMouseDown(e) {
        e.preventDefault();
        this._dragging = true;
        this._startX = e.clientX;
        this._startW = this.target.offsetWidth;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        const onMove = (ev) => {
            if (!this._dragging) return;
            const diff = ev.clientX - this._startX;
            let newWidth;
            if (this.side === 'left') {
                newWidth = this._startW + diff;
            } else {
                newWidth = this._startW - diff;
            }
            newWidth = Math.max(100, Math.min(500, newWidth));
            this.target.style.width = newWidth + 'px';
            if (this.app.engine) this.app.engine.resize();
        };
        const onUp = () => {
            this._dragging = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }

    _onDblClick() {
        if (this.side === 'left') {
            this.app.navigator.toggle();
        } else {
            this.app.sidebar.toggle();
        }
    }
}

/* ========================================================================
   Toolbar
   ======================================================================== */
class Toolbar {
    constructor(container, app) {
        this.app = app;
        this.container = container;
        this.activeViewMode = 'solid';
        this.isPerspective = true;
        this.measureActive = false;
        this.tooltips = app.tooltips;
        this.build();
    }

    _btn(icon, tooltip, onClick, id) {
        const b = el('div', { className: 'toolbar_btn', innerHTML: icon });
        if (id) b.id = id;
        b.addEventListener('click', onClick);
        this.tooltips.attach(b, tooltip);
        return b;
    }

    _separator() {
        return el('div', { className: 'toolbar_separator' });
    }

    build() {
        this.container.innerHTML = '';
        const self = this;

        // View mode group
        this.solidBtn = this._btn(SVG.cube, 'Solid', () => this.setViewMode('solid'), 'btn_solid');
        this.wireBtn = this._btn(SVG.wireframe, 'Wireframe', () => this.setViewMode('wireframe'), 'btn_wireframe');
        this.texBtn = this._btn(SVG.textured, 'Textured', () => this.setViewMode('textured'), 'btn_textured');
        this.solidBtn.classList.add('active');

        // Navigation
        this.fitBtn = this._btn(SVG.fitView, 'Fit to View (F)', () => {
            if (self.app.engine) self.app.engine.fitToView();
        }, 'btn_fit');
        this.flipBtn = this._btn(SVG.flip, 'Flip Up Vector', () => {
            if (self.app.engine) self.app.engine.setUpVector(self.app.engine.settings.upVector === 'Y' ? 'Z' : 'Y');
        }, 'btn_flip');

        // Projection
        this.projBtn = this._btn(SVG.perspective, 'Perspective / Orthographic', () => {
            self.isPerspective = !self.isPerspective;
            self.projBtn.innerHTML = self.isPerspective ? SVG.perspective : SVG.ortho;
            if (self.app.engine) self.app.engine.toggleProjection();
        }, 'btn_proj');

        // Predefined views dropdown
        this.viewDropdownBtn = this._buildViewDropdown();

        // Measure
        this.measureBtn = this._btn(SVG.measure, 'Measurement Tool', () => {
            self.measureActive = !self.measureActive;
            self.measureBtn.classList.toggle('active', self.measureActive);
            if (self.app.engine) { /* measure mode not yet implemented */ }
        }, 'btn_measure');

        // Screenshot
        this.screenshotBtn = this._btn(SVG.camera, 'Take Screenshot', () => {
            if (self.app.engine) self.app.engine.downloadScreenshot();
            else self.app.toast.show('No model loaded');
        }, 'btn_screenshot');

        // Assemble toolbar
        this.container.append(
            this.solidBtn, this.wireBtn, this.texBtn,
            this._separator(),
            this.fitBtn, this.flipBtn,
            this._separator(),
            this.projBtn, this.viewDropdownBtn,
            this._separator(),
            this.measureBtn,
            this._separator(),
            this.screenshotBtn
        );
    }

    _buildViewDropdown() {
        const self = this;
        const btn = el('div', { className: 'toolbar_btn toolbar_dropdown_btn' },
            el('span', {}, 'Views'),
            el('span', { innerHTML: SVG.dropdown, className: 'dropdown_arrow' })
        );
        this.tooltips.attach(btn, 'Predefined Views');

        const menu = el('div', { className: 'toolbar_dropdown_menu' });
        const views = ['Front', 'Back', 'Left', 'Right', 'Top', 'Bottom'];
        for (const v of views) {
            const item = el('div', { className: 'toolbar_dropdown_item', onClick: () => {
                if (self.app.engine) self.app.engine.setView(v.toLowerCase());
                menu.classList.remove('visible');
            }}, v);
            menu.appendChild(item);
        }
        btn.appendChild(menu);
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.classList.toggle('visible');
        });
        document.addEventListener('click', () => menu.classList.remove('visible'));
        return btn;
    }

    setViewMode(mode) {
        this.activeViewMode = mode;
        this.solidBtn.classList.toggle('active', mode === 'solid');
        this.wireBtn.classList.toggle('active', mode === 'wireframe');
        this.texBtn.classList.toggle('active', mode === 'textured');
        if (this.app.engine) {
            if (mode === 'wireframe') {
                this.app.engine.toggleWireframe(true);
            } else {
                this.app.engine.toggleWireframe(false);
            }
        }
    }
}

/* ========================================================================
   Intro Screen
   ======================================================================== */
class IntroScreen {
    constructor(container, app) {
        this.app = app;
        this.container = container;
        this.build();
    }

    build() {
        this.container.innerHTML = '';
        this.container.className = 'intro';

        const logo = el('div', { className: 'intro_logo' },
            el('span', { innerHTML: SVG.cube.replace('width="18"', 'width="64"').replace('height="18"', 'height="64"') })
        );

        const title = el('h1', { className: 'intro_title' }, '3D Viewer');
        const subtitle = el('p', { className: 'intro_subtitle' }, 'Online 3D Model Viewer');

        const dropText = el('div', { className: 'intro_drop_area' },
            el('p', { className: 'intro_drop_text' }, 'Drag & drop 3D model files here'),
            el('p', { className: 'intro_drop_or' }, 'or'),
            el('div', { className: 'intro_buttons' },
                el('button', { className: 'intro_btn intro_btn_primary', onClick: () => this.app.openFileDialog() },
                    el('span', { innerHTML: SVG.folder }),
                    'Open File'
                ),
                el('button', { className: 'intro_btn intro_btn_secondary', onClick: () => this.app.openURLDialog() },
                    el('span', { innerHTML: SVG.link }),
                    'Open URL'
                )
            )
        );

        const formats = el('div', { className: 'intro_formats' },
            el('p', { className: 'intro_formats_label' }, 'Supported formats:'),
            el('div', { className: 'intro_format_tags' },
                ...['OBJ', 'STL', 'GLTF', 'GLB', 'FBX', '3DS', 'PLY', 'DAE', '3DM', 'OFF', 'BIM'].map(f =>
                    el('span', { className: 'intro_format_tag', onClick: () => this.app.loadSampleModel(f.toLowerCase()) }, f)
                )
            )
        );

        const demoBtn = el('div', { className: 'intro_demo' },
            el('button', { className: 'intro_btn intro_btn_outline', onClick: () => this.app.loadSampleModel('cube') },
                'Load Sample Model'
            )
        );

        this.container.append(logo, title, subtitle, dropText, formats, demoBtn);
    }

    show() {
        this.container.style.display = 'flex';
        requestAnimationFrame(() => this.container.classList.add('visible'));
    }

    hide() {
        this.container.classList.remove('visible');
        setTimeout(() => {
            this.container.style.display = 'none';
        }, 400);
    }
}

/* ========================================================================
   App (Main Controller)
   ======================================================================== */
class App {
    constructor() {
        this.engine = null;
        this.modelLoaded = false;
        this.currentModelUrl = null;
        this.loadedFiles = [];

        // Managers
        this.tooltips = new TooltipManager();
        this.dialogs = new DialogManager();
        this.contextMenu = new ContextMenu();
        this.toast = new Toast();

        this._initDOM();
        this._initEngine();
        this._initHeader();
        this._initToolbar();
        this._initPanels();
        this._initSplitters();
        this._initDragDrop();
        this._initFileInput();
        this._initContextMenu();
        this._initKeyboard();
        this._initProgressBar();
        this._initIntro();
        this._checkHash();

        window.addEventListener('resize', () => {
            if (this.engine) this.engine.resize();
        });
    }

    /* ---- DOM Skeleton ---- */
    _initDOM() {
        // Only create elements if they don't already exist
        if (!qs('#header')) {
            const header = el('div', { id: 'header' },
                el('div', { id: 'header_logo' },
                    el('span', { innerHTML: SVG.cube }),
                    el('span', { className: 'header_title' }, 'Online 3D Viewer')
                ),
                el('div', { id: 'main_file_name', className: 'main_file_name' }),
                el('div', { id: 'header_buttons' })
            );
            document.body.prepend(header);
        }
        if (!qs('#main')) {
            const main = el('div', { id: 'main' },
                el('div', { id: 'main_navigator' }),
                el('div', { id: 'splitter_left', className: 'splitter' }),
                el('div', { id: 'main_center' },
                    el('div', { id: 'toolbar' }),
                    el('div', { id: 'main_viewer' }),
                    el('div', { id: 'intro' })
                ),
                el('div', { id: 'splitter_right', className: 'splitter' }),
                el('div', { id: 'main_sidebar' })
            );
            document.body.appendChild(main);
        }

        // Hidden file input
        if (!qs('#open_file')) {
            const fi = el('input', {
                type: 'file',
                id: 'open_file',
                multiple: true,
                style: { display: 'none' },
            });
            fi.setAttribute('accept', '.obj,.mtl,.stl,.gltf,.glb,.fbx,.3ds,.ply,.dae,.3dm,.off,.bim,.ifc,.brep,.step,.iges,.wrl,.3mf,.amf,.json');
            document.body.appendChild(fi);
        }
    }

    /* ---- Engine ---- */
    _initEngine() {
        const viewerContainer = qs('#main_viewer');
        if (!viewerContainer) return;
        try {
            if (typeof ViewerEngine !== 'undefined') {
                this.engine = new ViewerEngine(viewerContainer);
                // Listen for mesh selection events from the engine
                viewerContainer.addEventListener('mesh-selected', (e) => {
                    if (this.sidebar) this.sidebar.showMeshDetails(e.detail);
                });
                viewerContainer.addEventListener('mesh-deselected', () => {
                    if (this.sidebar) this.sidebar.showMeshDetails(null);
                });
            }
        } catch (e) {
            console.warn('ViewerEngine not available:', e);
        }
    }

    /* ---- Header Buttons ---- */
    _initHeader() {
        const container = qs('#header_buttons');
        if (!container) return;
        container.innerHTML = '';

        const makeBtn = (icon, tooltip, onClick) => {
            const b = el('div', { className: 'header_button', innerHTML: icon });
            b.addEventListener('click', onClick);
            this.tooltips.attach(b, tooltip);
            return b;
        };

        container.append(
            makeBtn(SVG.folder, 'Open File', () => this.openFileDialog()),
            makeBtn(SVG.link, 'Open URL', () => this.openURLDialog()),
            makeBtn(SVG.share, 'Share / Embed', () => this.dialogs.showShareDialog(this.currentModelUrl)),
            makeBtn(SVG.github, 'GitHub', () => window.open('https://github.com', '_blank')),
            makeBtn(SVG.info, 'About', () => this.dialogs.showAboutDialog())
        );
    }

    /* ---- Toolbar ---- */
    _initToolbar() {
        const container = qs('#toolbar');
        if (!container) return;
        this.toolbar = new Toolbar(container, this);
    }

    /* ---- Side Panels ---- */
    _initPanels() {
        const navContainer = qs('#main_navigator');
        const sideContainer = qs('#main_sidebar');
        if (navContainer) this.navigator = new NavigatorPanel(navContainer, this);
        if (sideContainer) this.sidebar = new SidebarPanel(sideContainer, this);
    }

    /* ---- Splitters ---- */
    _initSplitters() {
        const lSplitter = qs('#splitter_left');
        const rSplitter = qs('#splitter_right');
        const navEl = qs('#main_navigator');
        const sideEl = qs('#main_sidebar');
        if (lSplitter && navEl) new Splitter(lSplitter, navEl, 'left', this);
        if (rSplitter && sideEl) new Splitter(rSplitter, sideEl, 'right', this);
    }

    /* ---- Drag & Drop ---- */
    _initDragDrop() {
        const dropZone = qs('#main_center') || document.body;

        const prevent = (e) => { e.preventDefault(); e.stopPropagation(); };

        window.addEventListener('dragenter', (e) => {
            prevent(e);
            dropZone.classList.add('drag_over');
        });
        window.addEventListener('dragover', (e) => {
            prevent(e);
            dropZone.classList.add('drag_over');
        });
        window.addEventListener('dragleave', (e) => {
            prevent(e);
            // Only remove if leaving the window
            if (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
                dropZone.classList.remove('drag_over');
            }
        });
        window.addEventListener('drop', (e) => {
            prevent(e);
            dropZone.classList.remove('drag_over');
            const files = Array.from(e.dataTransfer.files);
            if (files.length > 0) {
                this.loadFiles(files);
            }
        });
    }

    /* ---- File Input ---- */
    _initFileInput() {
        const fileInput = qs('#open_file');
        if (!fileInput) return;
        fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                this.loadFiles(files);
            }
            fileInput.value = '';
        });
    }

    /* ---- Context Menu ---- */
    _initContextMenu() {
        const viewer = qs('#main_viewer');
        if (!viewer) return;
        viewer.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.contextMenu.show(e.clientX, e.clientY, [
                { label: 'Fit to View', action: () => { if (this.engine) this.engine.fitToView(); } },
                { separator: true },
                { label: 'Hide Selected', action: () => { if (this.engine && this.engine._selectedMesh) { this.engine._selectedMesh.visible = false; this.engine.deselectMesh(); } } },
                { label: 'Show All', action: () => { if (this.engine && this.engine._model) { this.engine._model.traverse(c => { c.visible = true; }); } } },
                { separator: true },
                { label: 'Properties', action: () => {
                    if (this.engine && this.engine._selectedMesh) {
                        const sel = this.engine.getMeshInfo(this.engine._selectedMesh);
                        if (sel) this.sidebar.showMeshDetails(sel);
                    }
                }},
            ]);
        });
    }

    /* ---- Keyboard Shortcuts ---- */
    _initKeyboard() {
        document.addEventListener('keydown', (e) => {
            // Don't trigger when typing in inputs
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            switch (e.key.toLowerCase()) {
                case 'f':
                    if (this.engine) this.engine.fitToView();
                    break;
                case 'delete':
                case 'backspace':
                    if (this.engine && this.engine._selectedMesh) {
                        this.engine._selectedMesh.visible = false;
                        this.engine.deselectMesh();
                    }
                    break;
                case 'escape':
                    if (this.engine) this.engine.deselectMesh();
                    if (this.sidebar) this.sidebar.showMeshDetails(null);
                    this.contextMenu.hide();
                    break;
            }
        });
    }

    /* ---- Progress Bar ---- */
    _initProgressBar() {
        const viewer = qs('#main_viewer');
        if (viewer) this.progress = new ProgressBar(viewer);
    }

    /* ---- Intro Screen ---- */
    _initIntro() {
        const introContainer = qs('#intro');
        if (introContainer) {
            this.intro = new IntroScreen(introContainer, this);
            if (!this.modelLoaded) this.intro.show();
        }
    }

    /* ---- URL Hash ---- */
    _checkHash() {
        const hash = window.location.hash;
        if (hash.startsWith('#model=')) {
            const url = decodeURIComponent(hash.substring(7));
            if (url) this.loadFromURL(url);
        }
        window.addEventListener('hashchange', () => {
            const h = window.location.hash;
            if (h.startsWith('#model=')) {
                const url = decodeURIComponent(h.substring(7));
                if (url) this.loadFromURL(url);
            }
        });
    }

    /* ---- Public Actions ---- */
    openFileDialog() {
        const fi = qs('#open_file');
        if (fi) fi.click();
    }

    openURLDialog() {
        this.dialogs.showOpenURLDialog((url) => this.loadFromURL(url));
    }

    loadFiles(files) {
        if (!files || files.length === 0) return;
        this.loadedFiles = Array.from(files).map(f => ({ name: f.name, size: f.size }));
        this.toast.show(`Loading ${files.length} file(s)...`);
        if (this.progress) {
            this.progress.show();
            this.progress.setProgress(15);
        }

        if (this.engine) {
            const fileList = Array.from(files);
            const modelExts = ['glb', 'gltf', 'obj', 'stl', 'fbx', 'ply', '3dm', 'dae', '3mf', 'off'];
            // Find the primary model file
            let modelFile = fileList.find(f => {
                const ext = f.name.split('.').pop().toLowerCase();
                return modelExts.includes(ext);
            }) || fileList[0];

            const ext = modelFile.name.split('.').pop().toLowerCase();
            const opts = {
                onProgress: (p) => {
                    if (this.progress && p.lengthComputable) {
                        this.progress.setProgress(Math.round((p.loaded / p.total) * 80) + 15);
                    }
                }
            };

            // If it's an OBJ, check for accompanying MTL file
            if (ext === 'obj') {
                const mtlFile = fileList.find(f => f.name.toLowerCase().endsWith('.mtl'));
                if (mtlFile) opts.mtlSource = mtlFile;
            }

            this.engine.loadModel(modelFile, opts).then(() => {
                if (this.progress) this.progress.hide();
                const sceneGraph = this.engine.getModelTree();
                this._onModelLoaded(sceneGraph, fileList);
            }).catch((err) => {
                if (this.progress) this.progress.hide();
                this.toast.show('Error loading file: ' + (err.message || err));
                console.error(err);
            });
        } else {
            this._simulateLoad(files[0] ? files[0].name : 'model');
        }
    }

    loadFromURL(url) {
        this.currentModelUrl = url;
        this.toast.show('Loading model from URL...');
        if (this.progress) {
            this.progress.show();
            this.progress.setProgress(10);
        }

        if (this.engine) {
            this.engine.loadModel(url, {
                onProgress: (p) => {
                    if (this.progress && p.lengthComputable) {
                        this.progress.setProgress(Math.round((p.loaded / p.total) * 90) + 10);
                    }
                }
            }).then(() => {
                if (this.progress) this.progress.hide();
                window.location.hash = 'model=' + encodeURIComponent(url);
                const sceneGraph = this.engine.getModelTree();
                this._onModelLoaded(sceneGraph, [{ name: url.split('/').pop() }]);
            }).catch((err) => {
                if (this.progress) this.progress.hide();
                this.toast.show('Error loading URL: ' + (err.message || err));
                console.error(err);
            });
        } else {
            this._simulateLoad(url.split('/').pop());
        }
    }

    loadSampleModel(format) {
        format = (format || 'glb').toLowerCase();
        this.toast.show(`Loading sample (${format.toUpperCase()})...`);

        if (format === 'gltf' || format === 'glb') {
            this.loadFromURL('assets/models/DamagedHelmet.glb');
        } else if (format === 'stl') {
            this.loadFromURL('assets/models/utah_teapot.stl');
        } else if (format === 'obj') {
            if (this.engine) {
                if (this.progress) {
                    this.progress.show();
                    this.progress.setProgress(20);
                }
                this.engine.loadModel('assets/models/solids.obj', {
                    mtlSource: 'assets/models/solids.mtl'
                }).then(() => {
                    if (this.progress) this.progress.hide();
                    const sceneGraph = this.engine.getModelTree();
                    this._onModelLoaded(sceneGraph, [{ name: 'solids.obj' }, { name: 'solids.mtl' }]);
                }).catch(err => {
                    if (this.progress) this.progress.hide();
                    this.toast.show('Error: ' + err.message);
                });
            }
        } else {
            if (this.engine) {
                const sampleType = (format === 'cube' || format === 'box' || format === 'off') ? 'cube' : 'knot';
                this.engine.createProceduralSample(sampleType);
                const sceneGraph = this.engine.getModelTree();
                this._onModelLoaded(sceneGraph, [{ name: `sample_${format}.mesh` }]);
            } else {
                this._simulateLoad('sample.' + format);
            }
        }
    }

    _simulateLoad(filename) {
        // If engine doesn't have file loading, create a default cube scene
        if (this.progress) this.progress.setProgress(50);
        setTimeout(() => {
            if (this.progress) {
                this.progress.setProgress(100);
                setTimeout(() => this.progress.hide(), 300);
            }
            // Create a fallback scene graph for UI demo
            const demoGraph = {
                name: 'Scene',
                type: 'Scene',
                uuid: 'scene-root-001',
                children: [
                    {
                        name: filename || 'Cube',
                        type: 'Mesh',
                        uuid: 'mesh-001',
                        vertexCount: 8,
                        faceCount: 12,
                        material: { name: 'Default', type: 'MeshStandardMaterial', color: '#cccccc' },
                        children: []
                    },
                    {
                        name: 'GridHelper',
                        type: 'GridHelper',
                        uuid: 'grid-001',
                        children: []
                    },
                    {
                        name: 'AmbientLight',
                        type: 'AmbientLight',
                        uuid: 'light-001',
                        children: []
                    },
                    {
                        name: 'DirectionalLight',
                        type: 'DirectionalLight',
                        uuid: 'light-002',
                        children: []
                    }
                ]
            };
            this._onModelLoaded(demoGraph, [{ name: filename }]);
        }, 500);
    }

    _onModelLoaded(sceneGraph, files) {
        this.modelLoaded = true;
        if (this.intro) this.intro.hide();
        this.toast.show('Model loaded successfully!');

        const nameEl = qs('#main_file_name');
        if (nameEl && files && files.length > 0) {
            nameEl.textContent = files.map(f => f.name || f).join(', ');
        }

        if (files && this.navigator) {
            this.navigator.setFiles(files.map(f => f.name || f));
        }
        if (sceneGraph && this.navigator) {
            this.navigator.setModelTree(sceneGraph);
        }
    }
}

/* ========================================================================
   Bootstrap
   ======================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
