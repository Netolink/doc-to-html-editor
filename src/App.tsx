import { useState, useEffect, useRef, MouseEvent } from 'react';
import { 
  Trash2, 
  Bold, 
  Italic, 
  Underline, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  AlignJustify, 
  List, 
  ListOrdered, 
  Outdent, 
  Indent, 
  Link2, 
  Unlink, 
  Image, 
  Printer, 
  Search, 
  Code, 
  Download, 
  Copy, 
  RotateCcw, 
  ChevronDown, 
  Check, 
  FileText, 
  Flame, 
  Grid,
  Sparkles,
  RefreshCw,
  HelpCircle,
  X,
  Undo,
  Redo
} from 'lucide-react';

const formatHTML = (html: string): string => {
  if (!html) return '';
  let formatted = '';
  let indent = 0;
  const tab = '  ';

  // These tags are block elements that we want on their own lines
  const blockTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'blockquote', 'pre', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'hr', 'br'];

  let processed = html;
  
  // Clean up any existing formatting spaces/newlines between elements
  processed = processed.replace(/>\s+</g, '><');

  // Insert markers to split block elements
  blockTags.forEach(tag => {
    // Opening tag
    const openRegex = new RegExp(`(<${tag}(?:\\s+[^>]*)?>)`, 'gi');
    processed = processed.replace(openRegex, '\n$1');
    // Closing tag
    const closeRegex = new RegExp(`(</${tag}>)`, 'gi');
    processed = processed.replace(closeRegex, '$1\n');
  });

  // Also format <hr> and self-closing tags
  processed = processed.replace(/(<hr[^>]*>)/gi, '\n$1\n');
  processed = processed.replace(/(<br[^>]*>)/gi, '$1\n');

  // Split lines
  const lines = processed.split('\n');
  
  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Check if it's a closing Tag only (e.g. </p> or </li> or </ul>)
    const isClosingOnly = trimmed.startsWith('</');
    const isOpeningOnly = trimmed.startsWith('<') && !trimmed.startsWith('</') && !trimmed.endsWith('/>') && !trimmed.includes('</') && !trimmed.match(/^<(br|hr|img|input)/i);

    if (isClosingOnly) {
      indent = Math.max(0, indent - 1);
    }

    const currentIndent = tab.repeat(indent);
    formatted += currentIndent + trimmed + '\n';

    if (isOpeningOnly) {
      indent += 1;
    }
  });

  return formatted.trim();
};

const normalizeHTML = (html: string): string => {
  if (!html) return '';
  return html
    .replace(/\s+/g, '')
    .replace(/\/>/g, '>')
    .replace(/<p><br><\/p>/gi, '<p></p>')
    .replace(/<p>&nbsp;<\/p>/gi, '<p></p>')
    .trim()
    .toLowerCase();
};

const cleanHTMLForQuill = (html: string): string => {
  if (!html) return '';
  return html
    .replace(/>\s+</g, '><')
    .trim();
};

const preCleanHTML = (html: string): string => {
  if (!html) return '';
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<body>${html}</body>`, 'text/html');
  const body = doc.body;

  // 1. Remove all span.ql-ui wrapper elements completely
  body.querySelectorAll('span.ql-ui').forEach(el => el.remove());

  // 2. Remove all class="ql-indent-*" classes from all elements
  body.querySelectorAll('*').forEach(el => {
    const classAttr = el.getAttribute('class');
    if (classAttr) {
      const remainingClasses = classAttr
        .split(/\s+/)
        .filter(cls => !cls.startsWith('ql-indent-'))
        .join(' ');
      if (remainingClasses) {
        el.setAttribute('class', remainingClasses);
      } else {
        el.removeAttribute('class');
      }
    }
  });

  // 3. Convert Quill list tags to standard nested ol/ul
  const allLis = Array.from(body.querySelectorAll('li'));
  
  let currentGroup: HTMLElement[] = [];
  let currentType: string | null = null;
  let currentParent: Node | null = null;

  const wrapGroup = (liGroup: HTMLElement[], type: string) => {
    if (liGroup.length === 0) return;
    const firstLi = liGroup[0];
    const parent = firstLi.parentNode;
    if (!parent) return;

    const listTag = type === 'ordered' ? 'ol' : 'ul';
    const listContainer = document.createElement(listTag);

    parent.insertBefore(listContainer, firstLi);

    liGroup.forEach(li => {
      li.removeAttribute('data-list');
      listContainer.appendChild(li);
    });
  };

  for (let i = 0; i < allLis.length; i++) {
    const li = allLis[i];
    const hasDataList = li.hasAttribute('data-list');
    const listType = li.getAttribute('data-list');
    const parent = li.parentNode;

    if (hasDataList && listType && (listType === 'bullet' || listType === 'ordered')) {
      if (currentGroup.length === 0) {
        currentGroup.push(li);
        currentType = listType;
        currentParent = parent;
      } else if (listType === currentType && parent === currentParent) {
        currentGroup.push(li);
      } else {
        wrapGroup(currentGroup, currentType!);
        currentGroup = [li];
        currentType = listType;
        currentParent = parent;
      }
    } else {
      if (currentGroup.length > 0) {
        wrapGroup(currentGroup, currentType!);
        currentGroup = [];
        currentType = null;
        currentParent = null;
      }
    }
  }

  if (currentGroup.length > 0) {
    wrapGroup(currentGroup, currentType!);
  }

  // Clean remaining data-list attributes anywhere to be 100% sure
  body.querySelectorAll('[data-list]').forEach(el => el.removeAttribute('data-list'));

  return body.innerHTML;
};

export default function App() {
  // State Constants
  const [activeTab, setActiveTab] = useState<'word' | 'html'>('word');
  const [documentHtml, setDocumentHtml] = useState<string>(
    `<h1 id="init-heading">Welcome to the Netolink Doc to HTML Editor!</h1>
<p>Write your document here or paste it directly from <strong>Word documents</strong> or <strong>Google Docs</strong>. All formatting, headers, list structures, links, and tables will be preserved and converted instantly.</p>
<ul>
  <li>Use the full formatting toolbar at the top to modify text.</li>
  <li>Right-click on table elements to access cell/table utilities.</li>
  <li>Switch to the <strong>HTML Code</strong> tab to clean and optimize code tags using advanced checkboxes!</li>
</ul>
<p>You can even find & replace phrases with the tool, toggle immediate code inline, or export the resulting clean workspace into <code>.html</code> or <code>.txt</code> formats instantly.</p>`
  );

  const [originalBeforeClean, setOriginalBeforeClean] = useState<string>('');
  const [hasCleanedHistory, setHasCleanedHistory] = useState<boolean>(false);
  
  // Word & Character count
  const [wordCount, setWordCount] = useState<number>(0);
  const [charCount, setCharCount] = useState<number>(0);
  const [direction, setDirection] = useState<'LTR' | 'RTL'>('LTR');

  // Inline source editor inside Word Tab state
  const [showInlineSource, setShowInlineSource] = useState<boolean>(false);

  // Find & Replace pane alignment
  const [showFindReplace, setShowFindReplace] = useState<boolean>(false);
  const [findText, setFindText] = useState<string>('');
  const [replaceText, setReplaceText] = useState<string>('');

  // Table Generator Grid Popover state
  const [showTablePicker, setShowTablePicker] = useState<boolean>(false);
  const [hoveredGrid, setHoveredGrid] = useState<{ r: number; c: number }>({ r: 0, c: 0 });

  // Right-click dynamic Context Menu state on table
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
  }>({ visible: false, x: 0, y: 0 });
  const [selectedCell, setSelectedCell] = useState<HTMLTableCellElement | null>(null);

  // Clean HTML options state
  const [showCleanOptions, setShowCleanOptions] = useState<boolean>(false);
  const [cleanOptions, setCleanOptions] = useState({
    allStyles: true,
    classes: true,
    ids: true,
    dataAttrs: true,
    ariaAttrs: true,
    comments: true,
    emptyTags: true,
    brInsideBlock: true,
    removeTargets: true,
    removeRels: true,
    tableAttrs: true,
    officeGdocsMarkup: true,
  });

  const toggleAllCheckboxes = () => {
    const allChecked = Object.values(cleanOptions).every(Boolean);
    setCleanOptions({
      allStyles: !allChecked,
      classes: !allChecked,
      ids: !allChecked,
      dataAttrs: !allChecked,
      ariaAttrs: !allChecked,
      comments: !allChecked,
      emptyTags: !allChecked,
      brInsideBlock: !allChecked,
      removeTargets: !allChecked,
      removeRels: !allChecked,
      tableAttrs: !allChecked,
      officeGdocsMarkup: !allChecked,
    });
  };

  // UI Toast indicators
  const [toastText, setToastText] = useState<string>('');
  const [showToast, setShowToast] = useState<boolean>(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState<boolean>(false);

  // Refs
  const editorRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const htmlTextareaRef = useRef<HTMLTextAreaElement>(null);
  const tablePickerRef = useRef<HTMLDivElement>(null);
  const cleanPanelRef = useRef<HTMLDivElement>(null);
  const tableContextMenuRef = useRef<HTMLDivElement>(null);
  
  // Tracking if HTML has actually been edited by user to avoid corrupting Quill structures
  const [htmlIsDirty, setHtmlIsDirty] = useState<boolean>(false);
  const inlineSourceOriginalRef = useRef<string>('');

  // Trigger Toast Notification
  const triggerToast = (msg: string) => {
    setToastText(msg);
    setShowToast(true);
  };

  useEffect(() => {
    if (showToast) {
      const t = setTimeout(() => setShowToast(false), 2100);
      return () => clearTimeout(t);
    }
  }, [showToast]);

  // Handle outside click to collapse overlays
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | any) => {
      if (showTablePicker && tablePickerRef.current && !tablePickerRef.current.contains(e.target as Node)) {
        setShowTablePicker(false);
      }
      if (showCleanOptions && cleanPanelRef.current && !cleanPanelRef.current.contains(e.target as Node)) {
        setShowCleanOptions(false);
      }
      if (contextMenu.visible && tableContextMenuRef.current && !tableContextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(prev => ({ ...prev, visible: false }));
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showTablePicker, showCleanOptions, contextMenu]);

  // Comprehensive Custom Keyboard shortcuts for the editor
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Check for control/meta key combinations
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        
        // Let normal browser native keys handle inputs
        const active = document.activeElement;
        const isInputFocused = active && 
          (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') && 
          (!quillRef.current || active !== quillRef.current.root);

        if (isInputFocused && key !== 'h') {
          // Allow default for native inputs except Ctrl+H Find & Replace
          return;
        }

        switch (key) {
          case 'z':
            if (activeTab === 'word' && quillRef.current) {
              e.preventDefault();
              quillRef.current.history.undo();
            }
            break;
          case 'y':
            if (activeTab === 'word' && quillRef.current) {
              e.preventDefault();
              quillRef.current.history.redo();
            }
            break;
          case 'b':
            if (activeTab === 'word' && quillRef.current) {
              e.preventDefault();
              executeCommand('bold');
            }
            break;
          case 'i':
            if (activeTab === 'word' && quillRef.current) {
              e.preventDefault();
              executeCommand('italic');
            }
            break;
          case 'u':
            if (activeTab === 'word' && quillRef.current) {
              e.preventDefault();
              executeCommand('underline');
            }
            break;
          case 'k':
            if (activeTab === 'word' && quillRef.current) {
              e.preventDefault();
              const url = prompt("Enter link URL:", "https://");
              if (url) {
                executeCommand('createlink', url);
              }
            }
            break;
          case 'h':
            e.preventDefault();
            setShowFindReplace(prev => !prev);
            break;
          case 'a':
            if (activeTab === 'word' && quillRef.current) {
              e.preventDefault();
              quillRef.current.setSelection(0, quillRef.current.getLength());
            }
            break;
          default:
            break;
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [activeTab, showInlineSource]);

  // Update counters based on input text
  const calculateCounters = (htmlContent: string) => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    const text = tempDiv.textContent || tempDiv.innerText || '';
    
    setCharCount(text.length);
    const wordsCleaned = text.replace(/[\t\r\n]/g, " ").trim();
    const wordList = wordsCleaned ? wordsCleaned.split(/\s+/) : [];
    setWordCount(wordList.length);

    // Auto detect LTR/RTL text direction on first characters typed
    if (text.trim().length > 0) {
      const firstChar = text.trim().charAt(0);
      const isRtl = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F]/.test(firstChar);
      setDirection(isRtl ? 'RTL' : 'LTR');
    }
  };

  // Sync initial word count
  useEffect(() => {
    calculateCounters(documentHtml);

    // Only initialize once
    if (quillRef.current) return;

    const Quill = (window as any).Quill;
    if (Quill && editorRef.current) {
      // Register custom horizontal rule (divider) blotting
      try {
        const BlockEmbed = Quill.import('blots/block/embed');
        class DividerBlot extends BlockEmbed {
          static create() {
            const node = document.createElement('hr');
            node.setAttribute('class', 'my-4 border-t border-gray-300');
            return node;
          }
        }
        DividerBlot.blotName = 'divider';
        DividerBlot.tagName = 'hr';
        Quill.register(DividerBlot, true);
      } catch (err) {
        console.warn("Blot registration skipped/existing", err);
      }

      // Initialize Quill
      const quill = new Quill(editorRef.current, {
        theme: 'snow',
        placeholder: 'Write your document here or paste it directly from Word or Google Docs...',
        modules: {
          toolbar: false, // Programmatic toolbar buttons
          table: true,    // Native table module activation
          history: {
            delay: 1000,
            maxStack: 100,
            userOnly: true
          }
        }
      });

      quillRef.current = quill;

      // Set initial content
      quill.root.innerHTML = documentHtml;

      // Listen for text-change events and sync state changes
      quill.on('text-change', () => {
        const content = quill.root.innerHTML;
        setDocumentHtml(content);
        calculateCounters(content);
      });

      // Right-click context menu on table elements inside Quill
      quill.root.addEventListener('contextmenu', (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const cell = target.closest('td') || target.closest('th');
        if (cell) {
          e.preventDefault();
          setSelectedCell(cell as HTMLTableCellElement);
          setContextMenu({
            visible: true,
            x: e.clientX,
            y: e.clientY + window.scrollY,
          });
        }
      });
    }
  }, []);

  const handleWordInput = () => {
    if (quillRef.current) {
      const content = quillRef.current.root.innerHTML;
      const sanitized = preCleanHTML(content);
      setDocumentHtml(sanitized);
      calculateCounters(sanitized);
    }
  };

  // Switch folder Tabs
  const switchTab = (tab: 'word' | 'html') => {
    if (activeTab === tab) return;

    if (activeTab === 'word') {
      let finalContent = documentHtml;
      if (showInlineSource && textareaRef.current) {
        finalContent = textareaRef.current.value;
      } else if (quillRef.current) {
        finalContent = quillRef.current.root.innerHTML;
      } else if (editorRef.current) {
        finalContent = editorRef.current.innerHTML;
      }
      
      const sanitized = preCleanHTML(finalContent);
      const formattedHTML = formatHTML(sanitized);
      setDocumentHtml(formattedHTML);
      calculateCounters(formattedHTML);
      setHtmlIsDirty(false); // reset edit tracker when entering HTML tab
      setActiveTab(tab);
    } else {
      // Sync from HTML Tab back to WYSIWYG
      let finalContent = documentHtml;
      if (htmlTextareaRef.current) {
        finalContent = htmlTextareaRef.current.value;
      }
      setActiveTab(tab);
      setShowInlineSource(false);

      if (htmlIsDirty) {
        setDocumentHtml(finalContent);
        setTimeout(() => {
          if (quillRef.current) {
            const cleaned = cleanHTMLForQuill(finalContent);
            const currentNorm = normalizeHTML(quillRef.current.root.innerHTML);
            const newNorm = normalizeHTML(cleaned);
            if (currentNorm !== newNorm) {
              quillRef.current.root.innerHTML = cleaned;
            }
          }
        }, 50);
        setHtmlIsDirty(false);
      } else {
        // If not customized, keep the raw unmodified HTML of Quill to keep internal data intact
        if (quillRef.current) {
          setDocumentHtml(quillRef.current.root.innerHTML);
        }
      }
    }
  };

  // Standard WYSIWYG command executive targeting Quill API
  const executeCommand = (command: string, arg: string = '') => {
    if (!quillRef.current) return;
    const quill = quillRef.current;
    
    // Maintain selection / focus inside Quill
    quill.focus();

    const formats = quill.getFormat();

    switch (command.toLowerCase()) {
      case 'bold':
        quill.format('bold', !formats.bold);
        break;
      case 'italic':
        quill.format('italic', !formats.italic);
        break;
      case 'underline':
        quill.format('underline', !formats.underline);
        break;
      case 'strikethrough':
        quill.format('strike', !formats.strike);
        break;
      case 'formatblock': {
        const tag = arg.toLowerCase();
        if (tag === 'h1' || tag === '<h1>') quill.format('header', 1);
        else if (tag === 'h2' || tag === '<h2>') quill.format('header', 2);
        else if (tag === 'h3' || tag === '<h3>') quill.format('header', 3);
        else if (tag === 'h4' || tag === '<h4>') quill.format('header', 4);
        else if (tag === 'blockquote' || tag === '<blockquote>') quill.format('blockquote', !formats.blockquote);
        else if (tag === 'pre' || tag === '<pre>') quill.format('code-block', !formats['code-block']);
        else {
          quill.format('header', false);
          quill.format('blockquote', false);
          quill.format('code-block', false);
        }
        break;
      }
      case 'justifyleft':
        quill.format('align', false);
        break;
      case 'justifycenter':
        quill.format('align', 'center');
        break;
      case 'justifyright':
        quill.format('align', 'right');
        break;
      case 'justifyfull':
        quill.format('align', 'justify');
        break;
      case 'insertunorderedlist':
        quill.format('list', formats.list === 'bullet' ? false : 'bullet');
        break;
      case 'insertorderedlist':
        quill.format('list', formats.list === 'ordered' ? false : 'ordered');
        break;
      case 'outdent':
        quill.format('indent', formats.indent ? formats.indent - 1 : false);
        break;
      case 'indent':
        quill.format('indent', (formats.indent || 0) + 1);
        break;
      case 'createlink':
        quill.format('link', arg);
        break;
      case 'unlink':
        quill.format('link', false);
        break;
      case 'insertimage': {
        const range = quill.getSelection(true);
        if (range) {
          quill.insertEmbed(range.index, 'image', arg);
          quill.setSelection(range.index + 1);
        }
        break;
      }
      case 'forecolor':
        quill.format('color', arg);
        break;
      case 'hilitecolor':
        quill.format('background', arg);
        break;
      case 'inserthorizontalrule': {
         const range = quill.getSelection(true);
         if (range) {
           quill.insertEmbed(range.index, 'divider', true);
           // insert new line
           quill.insertText(range.index + 1, '\n');
           quill.setSelection(range.index + 2);
         }
         break;
      }
      case 'inserthtml': {
        const range = quill.getSelection(true);
        if (range) {
          quill.clipboard.dangerouslyPasteHTML(range.index, arg);
        }
        break;
      }
      default:
        // Fail-safe fallback to execCommand
        document.execCommand(command, false, arg);
    }
    
    // Sync React state and triggers
    const content = quill.root.innerHTML;
    setDocumentHtml(content);
    calculateCounters(content);
  };

  const handleUndo = () => {
    if (activeTab === 'word' && quillRef.current) {
      quillRef.current.history.undo();
    }
  };

  const handleRedo = () => {
    if (activeTab === 'word' && quillRef.current) {
      quillRef.current.history.redo();
    }
  };

  // Clear Formatting using Quill APIs
  const clearFormatting = () => {
    if (quillRef.current) {
      const range = quillRef.current.getSelection();
      if (range) {
        quillRef.current.removeFormat(range.index, range.length);
        const content = quillRef.current.root.innerHTML;
        setDocumentHtml(content);
        calculateCounters(content);
      }
    } else {
      document.execCommand('removeFormat', false);
    }
    triggerToast("Cleared text override styling!");
  };

  // Setup prompt Link
  const promptLink = () => {
    const url = prompt("Please enter the hyperlinked target address (e.g. https://google.com):", "https://");
    if (url) {
      executeCommand('createLink', url);
    }
  };

  const promptImage = () => {
    const url = prompt("Enter source image URL link:", "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600");
    if (url) {
      executeCommand('insertImage', url);
    }
  };

  // Manually toggle direction
  const toggleDirectionState = (dir: 'LTR' | 'RTL') => {
    setDirection(dir);
    if (quillRef.current) {
      quillRef.current.root.dir = dir.toLowerCase();
      quillRef.current.root.style.textAlign = dir === 'RTL' ? 'right' : 'left';
    }
    if (editorRef.current) {
      editorRef.current.dir = dir.toLowerCase();
      editorRef.current.style.textAlign = dir === 'RTL' ? 'right' : 'left';
    }
  };

  // Paste Clean Filters for clipboard contents
  const handlePaste = (e: any) => {
    const clipboardData = e.clipboardData;
    if (!clipboardData) return;

    const html = clipboardData.getData('text/html');
    if (html) {
      e.preventDefault();
      
      let parsed = html;
      parsed = parsed.replace(/<link.*?>/gi, '');
      parsed = parsed.replace(/<style([\s\S]*?)>([\s\S]*?)<\/style>/gi, '');
      parsed = parsed.replace(/<!--[\s\S]*?-->/gi, '');

      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = parsed;

      const spans = tempDiv.querySelectorAll('span');
      spans.forEach(s => {
        if (s.id && s.id.startsWith('docs-internal-guid')) {
          const range = document.createRange();
          range.selectNodeContents(s);
          s.parentNode?.replaceChild(range.extractContents(), s);
        }
      });

      // Insert clean fragment safely
      const sel = window.getSelection();
      if (sel && sel.rangeCount) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        const docFrag = document.createDocumentFragment();
        while (tempDiv.firstChild) {
          docFrag.appendChild(tempDiv.firstChild);
        }
        range.insertNode(docFrag);
      }
      setTimeout(() => handleWordInput(), 50);
    }
  };

  // Right click table trigger
  const handleTableCellContextMenu = (e: MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const cell = target.closest('td') || target.closest('th');
    if (cell) {
      e.preventDefault();
      setSelectedCell(cell as HTMLTableCellElement);
      setContextMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY + window.scrollY,
      });
    }
  };

  // Table context manipulations targeting native Quill table API to avoid model desync
  const runTableAction = (action: string) => {
    if (quillRef.current) {
      const tableModule = quillRef.current.getModule('table');
      if (tableModule) {
        switch (action) {
          case 'addRowAbove':
            tableModule.insertRowAbove();
            break;
          case 'addRowBelow':
            tableModule.insertRowBelow();
            break;
          case 'deleteRow':
            tableModule.deleteRow();
            break;
          case 'addColumnLeft':
            tableModule.insertColumnLeft();
            break;
          case 'addColumnRight':
            tableModule.insertColumnRight();
            break;
          case 'deleteColumn':
            tableModule.deleteColumn();
            break;
          case 'deleteTable':
            tableModule.deleteTable();
            break;
          case 'mergeCells':
            triggerToast("Cell merges are done programmatically in native grids.");
            break;
          case 'splitCell':
            triggerToast("Cell splits are done programmatically in native grids.");
            break;
        }
        // Force refresh and sync
        const content = quillRef.current.root.innerHTML;
        setDocumentHtml(content);
        calculateCounters(content);
        setContextMenu(prev => ({ ...prev, visible: false }));
        triggerToast("Table layout restructured!");
        return;
      }
    }

    if (!selectedCell) return;
    const tr = selectedCell.parentNode as HTMLTableRowElement;
    const table = tr.closest('table');
    if (!table) return;

    const rowIndex = Array.from(tr.parentNode?.children || []).indexOf(tr);
    const colIndex = Array.from(tr.children).indexOf(selectedCell);

    switch (action) {
      case 'addRowAbove': {
        const newTr = table.insertRow(rowIndex);
        for (let i = 0; i < tr.cells.length; i++) {
          const newTd = newTr.insertCell();
          newTd.className = "border border-slate-300 p-2 min-w-[50px]";
          newTd.innerHTML = "Cell";
        }
        break;
      }
      case 'addRowBelow': {
        const newTr = table.insertRow(rowIndex + 1);
        for (let i = 0; i < tr.cells.length; i++) {
          const newTd = newTr.insertCell();
          newTd.className = "border border-slate-300 p-2 min-w-[50px]";
          newTd.innerHTML = "Cell";
        }
        break;
      }
      case 'deleteRow': {
        table.deleteRow(rowIndex);
        break;
      }
      case 'addColumnLeft': {
        const rows = Array.from(table.rows);
        rows.forEach(row => {
          const cell = row.insertCell(colIndex);
          cell.className = "border border-slate-300 p-2 min-w-[50px]";
          cell.innerHTML = "Cell";
        });
        break;
      }
      case 'addColumnRight': {
        const rows = Array.from(table.rows);
        rows.forEach(row => {
          const cell = row.insertCell(colIndex + 1);
          cell.className = "border border-slate-300 p-2 min-w-[50px]";
          cell.innerHTML = "Cell";
        });
        break;
      }
      case 'deleteColumn': {
        const rows = Array.from(table.rows);
        rows.forEach(row => {
          row.deleteCell(colIndex);
        });
        break;
      }
      case 'mergeCells': {
        const span = prompt("Enter columns span merge scale rightwards:", "2");
        if (span) {
          selectedCell.colSpan = parseInt(span) || 1;
        }
        break;
      }
      case 'splitCell': {
        selectedCell.colSpan = 1;
        selectedCell.rowSpan = 1;
        break;
      }
    }

    setContextMenu(prev => ({ ...prev, visible: false }));
    handleWordInput();
    triggerToast("Table layout restructured!");
  };

  // Find & Replace actions
  const handleFindReplace = (type: 'find' | 'replace' | 'replaceAll') => {
    if (!findText) {
      triggerToast("Enter a search keyword first.");
      return;
    }
    const html = documentHtml;

    if (type === 'find') {
      const regex = new RegExp(escapeRegExp(findText), 'gi');
      const count = (html.match(regex) || []).length;
      triggerToast(`Found ${count} instances inside draft.`);
    } else if (type === 'replace') {
      const regex = new RegExp(escapeRegExp(findText), 'i');
      if (regex.test(html)) {
        const updated = html.replace(regex, replaceText);
        setDocumentHtml(updated);
        calculateCounters(updated);
        if (quillRef.current) {
          quillRef.current.root.innerHTML = updated;
        }
        triggerToast("Replaced next occurrence.");
      } else {
        triggerToast("No matching phrase to replace.");
      }
    } else {
      const regex = new RegExp(escapeRegExp(findText), 'g');
      const count = (html.match(regex) || []).length;
      if (count > 0) {
        const updated = html.replace(regex, replaceText);
        setDocumentHtml(updated);
        calculateCounters(updated);
        if (quillRef.current) {
          quillRef.current.root.innerHTML = updated;
        }
        triggerToast(`Replaced all ${count} occurrences.`);
      } else {
        triggerToast("No occurrences found.");
      }
    }
  };

  const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Table grid Picker inserter
  const createTableGrid = (r: number, c: number) => {
    let tbl = '<table class="w-full border-collapse border border-slate-300 my-4">';
    for (let row = 0; row < r; row++) {
      tbl += '<tr>';
      for (let col = 0; col < c; col++) {
        if (row === 0) {
          tbl += '<th class="border border-slate-300 p-2 font-semibold bg-slate-50">Header</th>';
        } else {
          tbl += '<td class="border border-slate-300 p-2">Cell</td>';
        }
      }
      tbl += '</tr>';
    }
    tbl += '</table>';

    executeCommand('insertHTML', tbl);
    setShowTablePicker(false);
    triggerToast(`Inserted table matching grid indices: ${r}×${c}`);
  };

  // Reset checkboxes to prompt-friendly defaults
  const resetCheckboxes = () => {
    setCleanOptions({
      allStyles: true,
      classes: true,
      ids: true,
      dataAttrs: true,
      ariaAttrs: true,
      comments: true,
      emptyTags: true,
      brInsideBlock: true,
      removeTargets: true,
      removeRels: true,
      tableAttrs: true,
      officeGdocsMarkup: true,
    });
  };

  // Apply Clean Engine HTML parser
  const runHTMLCleaning = () => {
    // Check if any checkbox is selected. If zero checkboxes are selected, do absolutely nothing.
    const hasAnyOptionSelected = Object.values(cleanOptions).some(val => val === true);
    if (!hasAnyOptionSelected) {
      triggerToast("No cleanup options selected. No changes made.");
      setShowCleanOptions(false);
      return;
    }

    const initialText = activeTab === 'html' && htmlTextareaRef.current ? htmlTextareaRef.current.value : documentHtml;
    setOriginalBeforeClean(initialText);

    const optAllStyles = cleanOptions.allStyles;
    const optClasses = cleanOptions.classes;
    const optIds = cleanOptions.ids;
    const optDataAttrs = cleanOptions.dataAttrs;
    const optAriaAttrs = cleanOptions.ariaAttrs;
    const optComments = cleanOptions.comments;
    const optEmptyTags = cleanOptions.emptyTags;
    const optRemoveTargets = cleanOptions.removeTargets;
    const optRemoveRels = cleanOptions.removeRels;
    const optTableAttrs = cleanOptions.tableAttrs;
    const optOfficeGDocs = cleanOptions.officeGdocsMarkup;

    // Use DOMParser as requested
    const parser = new DOMParser();
    const doc = parser.parseFromString(initialText, 'text/html');
    const body = doc.body;

    // Recursive traversal to safely strip attributes without changing elements/unwrap
    const cleanDomRecursive = (node: Node) => {
      const children = Array.from(node.childNodes);
      for (const child of children) {
        cleanDomRecursive(child);
      }

      // Process Comments (nodeType === 8)
      if (node.nodeType === 8) {
        if (optComments || optOfficeGDocs) {
          node.parentNode?.removeChild(node);
        }
        return;
      }

      // Process Elements (nodeType === 1)
      if (node.nodeType === 1) {
        const el = node as HTMLElement;
        const tag = el.tagName.toLowerCase();

        // 1. Remove style-related attributes if optAllStyles is checked
        if (optAllStyles) {
          el.removeAttribute('style');
          el.removeAttribute('color');
          el.removeAttribute('size');
          el.removeAttribute('face');
        } else if (optOfficeGDocs) {
          // Remove Microsoft-specific mso- properties from style attribute without removing style entirely
          const styleAttr = el.getAttribute('style');
          if (styleAttr) {
            const cleanStyle = styleAttr
              .split(';')
              .map(part => part.trim())
              .filter(part => {
                if (!part) return false;
                return !part.toLowerCase().startsWith('mso-');
              })
              .join('; ');
            if (cleanStyle) {
              el.setAttribute('style', cleanStyle);
            } else {
              el.removeAttribute('style');
            }
          }
        }

        // 2. Remove class attributes
        if (optClasses) {
          el.removeAttribute('class');
        } else if (optOfficeGDocs) {
          const cls = el.getAttribute('class');
          if (cls && cls.includes('docs-internal-guid')) {
            el.removeAttribute('class');
          }
        }

        // 3. Remove ID attributes
        if (optIds) {
          el.removeAttribute('id');
        } else if (optOfficeGDocs) {
          const idVal = el.getAttribute('id');
          if (idVal && idVal.startsWith('docs-internal-guid')) {
            el.removeAttribute('id');
          }
        }

        // 4. Remove data-* attributes
        if (optDataAttrs) {
          const attrsToRemove: string[] = [];
          for (let i = 0; i < el.attributes.length; i++) {
            const name = el.attributes[i].name;
            if (name.startsWith('data-')) {
              attrsToRemove.push(name);
            }
          }
          attrsToRemove.forEach(name => el.removeAttribute(name));
        }

        // 5. Remove aria-* attributes
        if (optAriaAttrs) {
          const attrsToRemove: string[] = [];
          for (let i = 0; i < el.attributes.length; i++) {
            const name = el.attributes[i].name;
            if (name.startsWith('aria-')) {
              attrsToRemove.push(name);
            }
          }
          attrsToRemove.forEach(name => el.removeAttribute(name));
        }

        // 6. Remove target and rel from links
        if (tag === 'a') {
          if (optRemoveTargets) {
            el.removeAttribute('target');
          }
          if (optRemoveRels) {
            el.removeAttribute('rel');
          }
        }

        // 7. Remove table attributes
        if (optTableAttrs && ['table', 'tr', 'td', 'th', 'thead', 'tbody'].includes(tag)) {
          el.removeAttribute('width');
          el.removeAttribute('height');
          el.removeAttribute('cellpadding');
          el.removeAttribute('cellspacing');
          el.removeAttribute('border');
        }

        // 8. Remove Office/GDocs markup namespace attributes
        if (optOfficeGDocs) {
          el.removeAttribute('xmlns');
          el.removeAttribute('xmlns:o');
          el.removeAttribute('xmlns:w');
          el.removeAttribute('xml:lang');

          const officeAttrs: string[] = [];
          for (let i = 0; i < el.attributes.length; i++) {
            const name = el.attributes[i].name;
            if (name.includes(':')) {
              officeAttrs.push(name);
            }
          }
          officeAttrs.forEach(name => el.removeAttribute(name));
        }

        // 9. Remove empty elements only (never touch other elements or its text content)
        if (optEmptyTags) {
          const NEVER_REMOVE_TAGS = ['li', 'ul', 'ol', 'td', 'th', 'tr', 'table', 'thead', 'tbody', 'body', 'html'];
          if (!NEVER_REMOVE_TAGS.includes(tag)) {
            const hasImgBrHr = el.querySelector('img, br, hr') !== null;
            if (el.textContent?.trim() === '' && !hasImgBrHr) {
              el.parentNode?.removeChild(el);
              return;
            }
          }
        }
      }
    };

    cleanDomRecursive(body);

    // Serialize back using innerHTML
    const outputHtml = body.innerHTML;
    const finalResult = outputHtml.replace(/ {2,}/g, ' ').trim();

    // The preCleanHTML is only run on the final HTML output display and counters
    const displayResult = preCleanHTML(finalResult);
    const formattedResult = formatHTML(displayResult);
    setDocumentHtml(formattedResult);
    calculateCounters(formattedResult);
    if (htmlTextareaRef.current) {
      htmlTextareaRef.current.value = formattedResult;
    }

    // Write pristine cleaned content (without preCleanHTML) back to Quill to retain standard editor state
    if (quillRef.current) {
      quillRef.current.root.innerHTML = cleanHTMLForQuill(finalResult);
    }

    setHasCleanedHistory(true);
    setShowCleanOptions(false);
    triggerToast("Applied advanced DOM cleanup parameters successfully!");
  };

  const undoHtmlClean = () => {
    if (!hasCleanedHistory) return;
    if (quillRef.current) {
      quillRef.current.clipboard.dangerouslyPasteHTML(originalBeforeClean);
      const syncedHtml = quillRef.current.root.innerHTML;
      const formattedResult = formatHTML(syncedHtml);
      setDocumentHtml(formattedResult);
      if (htmlTextareaRef.current) {
        htmlTextareaRef.current.value = formattedResult;
      }
    } else {
      const formattedResult = formatHTML(originalBeforeClean);
      setDocumentHtml(formattedResult);
      if (htmlTextareaRef.current) {
        htmlTextareaRef.current.value = formattedResult;
      }
    }
    setHasCleanedHistory(false);
    triggerToast("Undone last cleaning filters!");
  };

  // Copy / Clipboard interactions
  const handleCopyHTML = () => {
    let codeContent = documentHtml;
    
    // Sync if tab is currently on edits
    if (activeTab === 'html' && htmlTextareaRef.current) {
      codeContent = htmlTextareaRef.current.value;
    } else if (activeTab === 'word' && showInlineSource && textareaRef.current) {
      codeContent = textareaRef.current.value;
    }

    const cleanOutput = preCleanHTML(codeContent);
    navigator.clipboard.writeText(cleanOutput).then(() => {
      triggerToast("HTML copied to Clipboard!");
    });
  };

  const handleCopyText = () => {
    const tempDiv = document.createElement('div');
    const cleanOutput = preCleanHTML(documentHtml);
    tempDiv.innerHTML = cleanOutput;
    const txt = tempDiv.textContent || tempDiv.innerText || '';
    
    navigator.clipboard.writeText(txt.trim()).then(() => {
      triggerToast("Plaintext copied to Clipboard!");
    });
  };

  // Downloads files hooks
  const downloadHtmlDocument = () => {
    const cleanOutput = preCleanHTML(documentHtml);
    const blob = new Blob([cleanOutput], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "doc-clean.html";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerToast("Downloaded clean HTML file!");
  };

  const downloadTextDocument = () => {
    const tempDiv = document.createElement('div');
    const cleanOutput = preCleanHTML(documentHtml);
    tempDiv.innerHTML = cleanOutput;
    const txt = tempDiv.textContent || tempDiv.innerText || '';

    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "doc-text.txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerToast("Downloaded text file!");
  };

  // Calculate code lines count
  const lineCountArray = documentHtml.split('\n').map((_, idx) => idx + 1);

  return (
    <div className="bg-[#f5f5f5] text-[#1a1a1a] font-sans antialiased min-h-screen py-6 px-6 relative flex flex-col">
      
      {/* Outer Shell */}
      <main className="max-w-[1100px] mx-auto pb-12 w-full flex-grow flex flex-col">
        
        {/* Header Block according to Bento Grid mockup style */}
        <header className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-transparent px-2">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-[#2c7be5]" id="app-title-tag">Netolink</span>
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Doc to HTML</span>
            </div>
            <p className="text-sm text-gray-500 mt-1">Convert pasted document text into clean, optimized markup for WordPress/HTML</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex bg-gray-200 p-1 rounded-t-lg shadow-sm" id="tab-controls-group">
              <button
                id="word-tab-toggle"
                onClick={() => switchTab('word')}
                className={`px-6 py-2 text-sm font-semibold rounded-t-md transition-all duration-150 flex items-center gap-1.5 ${
                  activeTab === 'word' 
                    ? 'bg-white text-[#2c7be5] border-t-2 border-[#2c7be5] shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900 transition-colors'
                }`}
              >
                <FileText className="w-4 h-4" />
                Doc
              </button>
              <button
                id="html-tab-toggle"
                onClick={() => switchTab('html')}
                className={`px-6 py-2 text-sm font-semibold rounded-t-md transition-all duration-150 flex items-center gap-1.5 ${
                  activeTab === 'html' 
                    ? 'bg-white text-[#2c7be5] border-t-2 border-[#2c7be5] shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900 transition-colors'
                }`}
              >
                <Code className="w-4 h-4" />
                HTML Editor
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] bg-slate-200 text-slate-700 px-2.5 py-1 rounded-full font-semibold select-none shadow-none">English UI</span>
            </div>
          </div>
        </header>

        {/* Dynamic Display Panel Groups */}
        <div id="main-editor-container-panels" className="flex flex-col bg-white rounded-b-xl rounded-tr-xl border border-[#dee2e6] shadow-sm overflow-hidden min-h-[500px] relative">
          
          {/* TAB 1: DOC EDITOR */}
          <div 
            id="tab-word-panel-content" 
            className={`flex flex-col flex-grow ${activeTab === 'word' ? '' : 'hidden'}`}
          >
              
              {/* Rich Text Custom Toolbar */}
              <div id="rich-toolbar-dock" className="bg-[#f8f9fa] border-b border-[#dee2e6] p-2 flex flex-wrap gap-1 items-center select-none text-gray-700">
                
                {/* Undo / Redo */}
                <button type="button" onClick={handleUndo} title="Undo (Ctrl+Z)" className="p-1.5 rounded hover:bg-gray-200 text-gray-700">
                  <Undo className="w-4 h-4 stroke-[2.5]" />
                </button>
                <button type="button" onClick={handleRedo} title="Redo (Ctrl+Y)" className="p-1.5 rounded hover:bg-gray-200 text-gray-700">
                  <Redo className="w-4 h-4 stroke-[2.5]" />
                </button>
                <div className="h-5 w-[1px] bg-gray-300 mx-1"></div>

                {/* Clear Formatting */}
                <button type="button" onClick={clearFormatting} title="Clear Formatting (Selection)" className="p-1.5 rounded hover:bg-gray-200 text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
                <div className="h-5 w-[1px] bg-gray-300 mx-1"></div>

                {/* Block dropdown formatting */}
                <select 
                  id="toolbar-format-block-select"
                  onChange={(e) => {
                    executeCommand('formatBlock', e.target.value);
                    e.target.value = '';
                  }}
                  className="p-1 text-xs border border-gray-300 rounded bg-white hover:border-gray-400 font-semibold outline-none focus:ring-1 focus:ring-[#2c7be5]"
                  defaultValue=""
                >
                  <option value="" disabled>Format...</option>
                  <option value="P">Paragraph</option>
                  <option value="H1">Heading 1</option>
                  <option value="H2">Heading 2</option>
                  <option value="H3">Heading 3</option>
                  <option value="H4">Heading 4</option>
                  <option value="BLOCKQUOTE">Blockquote</option>
                  <option value="PRE">Code Block</option>
                </select>
                <div className="h-5 w-[1px] bg-gray-300 mx-1"></div>

                {/* Styles */}
                <button type="button" onClick={() => executeCommand('bold')} title="Bold" className="p-1.5 rounded hover:bg-gray-200 font-bold">B</button>
                <button type="button" onClick={() => executeCommand('italic')} title="Italic" className="p-1.5 rounded hover:bg-gray-200 italic font-serif px-2">I</button>
                <button type="button" onClick={() => executeCommand('underline')} title="Underline" className="p-1.5 rounded hover:bg-gray-200 underline px-1.5">U</button>
                <button type="button" onClick={() => executeCommand('strikeThrough')} title="Strikethrough" className="p-1.5 rounded hover:bg-gray-200 line-through text-xs font-bold px-1.5">S</button>
                <div className="h-5 w-[1px] bg-gray-300 mx-1"></div>

                {/* Alignment */}
                <button type="button" onClick={() => executeCommand('justifyLeft')} title="Align Left" className="p-1.5 rounded hover:bg-gray-200"><AlignLeft className="w-4 h-4" /></button>
                <button type="button" onClick={() => executeCommand('justifyCenter')} title="Align Center" className="p-1.5 rounded hover:bg-gray-200"><AlignCenter className="w-4 h-4" /></button>
                <button type="button" onClick={() => executeCommand('justifyRight')} title="Align Right" className="p-1.5 rounded hover:bg-gray-200"><AlignRight className="w-4 h-4" /></button>
                <button type="button" onClick={() => executeCommand('justifyFull')} title="Justify" className="p-1.5 rounded hover:bg-gray-200"><AlignJustify className="w-4 h-4" /></button>
                <div className="h-5 w-[1px] bg-gray-300 mx-1"></div>

                {/* Lists */}
                <button type="button" onClick={() => executeCommand('insertUnorderedList')} title="Unordered List" className="p-1.5 rounded hover:bg-gray-200"><List className="w-4 h-4" /></button>
                <button type="button" onClick={() => executeCommand('insertOrderedList')} title="Ordered List" className="p-1.5 rounded hover:bg-gray-200"><ListOrdered className="w-4 h-4" /></button>
                <button type="button" onClick={() => executeCommand('outdent')} title="Outdent" className="p-1.5 rounded hover:bg-gray-200"><Outdent className="w-4 h-4" /></button>
                <button type="button" onClick={() => executeCommand('indent')} title="Indent" className="p-1.5 rounded hover:bg-gray-200"><Indent className="w-4 h-4" /></button>
                <div className="h-5 w-[1px] bg-gray-300 mx-1"></div>

                {/* Hyperlinks */}
                <button type="button" onClick={promptLink} title="Insert Link" className="p-1.5 rounded hover:bg-gray-200"><Link2 className="w-4 h-4" /></button>
                <button type="button" onClick={() => executeCommand('unlink')} title="Remove Link" className="p-1.5 rounded hover:bg-gray-200 opacity-60"><Unlink className="w-4 h-4" /></button>
                <button type="button" onClick={promptImage} title="Insert Image" className="p-1.5 rounded hover:bg-gray-200"><Image className="w-4 h-4" /></button>
                <div className="h-5 w-[1px] bg-gray-300 mx-1"></div>

                {/* Font Color, Bg color */}
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-gray-500 font-bold select-none">Txt</span>
                  <input 
                    type="color" 
                    onChange={(e) => executeCommand('foreColor', e.target.value)}
                    className="w-5 h-5 p-0 border-0 cursor-pointer rounded" 
                    title="Font Color"
                  />
                </div>
                <div className="flex items-center gap-1 ml-1.5">
                  <span className="text-[10px] text-gray-500 font-bold select-none">Bg</span>
                  <input 
                    type="color" 
                    onChange={(e) => executeCommand('hiliteColor', e.target.value)}
                    className="w-5 h-5 p-0 border-0 cursor-pointer rounded" 
                    title="Background Color"
                  />
                </div>
                <div className="h-5 w-[1px] bg-gray-300 mx-1"></div>

                {/* Table Picker Trigger */}
                <div className="relative" ref={tablePickerRef}>
                  <button 
                    type="button" 
                    id="table-toggle-trigger"
                    onClick={() => setShowTablePicker(!showTablePicker)}
                    className="p-1.5 rounded hover:bg-gray-200 flex items-center gap-0.5 text-gray-700"
                    title="Insert Grid Table"
                  >
                    <Grid className="w-4 h-4" />
                    <ChevronDown className="w-3 h-3" />
                  </button>

                  {showTablePicker && (
                    <div id="table-picker-popover-box" className="absolute left-0 mt-1.5 p-3.5 bg-white border border-slate-300 rounded-md z-40 shadow-xl w-48 text-left">
                      <p className="text-[11px] text-gray-500 font-semibold mb-2 text-center select-none">
                        {hoveredGrid.r > 0 ? `${hoveredGrid.r} × ${hoveredGrid.c} Table` : 'Choose dimensions'}
                      </p>
                      <div className="grid grid-cols-8 gap-[3px] cursor-pointer" onMouseLeave={() => setHoveredGrid({ r: 0, c: 0 })}>
                        {Array.from({ length: 8 }).map((_, rIdx) => 
                          Array.from({ length: 8 }).map((_, cIdx) => {
                            const r = rIdx + 1;
                            const c = cIdx + 1;
                            const isActive = r <= hoveredGrid.r && c <= hoveredGrid.c;
                            return (
                              <div
                                key={`${rIdx}-${cIdx}`}
                                onMouseOver={() => setHoveredGrid({ r, c })}
                                onClick={() => createTableGrid(r, c)}
                                className={`w-3.5 h-3.5 border rounded-[1px] transition-colors duration-75 ${
                                  isActive ? 'border-[#2c7be5] bg-[#2c7be5]/20' : 'border-gray-200 bg-white'
                                }`}
                              />
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div className="h-5 w-[1px] bg-gray-300 mx-1"></div>

                {/* HR, Print */}
                <button type="button" onClick={() => executeCommand('insertHorizontalRule')} title="Insert horizontal split" className="p-1.5 rounded hover:bg-gray-200"><span className="font-semibold text-sm">HR</span></button>
                <button type="button" onClick={() => window.print()} title="Print document" className="p-1.5 rounded hover:bg-gray-200"><Printer className="w-4 h-4" /></button>
                <div className="h-5 w-[1px] bg-gray-300 mx-1"></div>

                {/* RTL/LTR text alignments manual triggers */}
                <div className="flex items-center gap-0.5 bg-gray-200 px-1 py-0.5 rounded-md text-[10px] font-semibold" id="manual-direction-toggles">
                  <button 
                    type="button" 
                    onClick={() => toggleDirectionState('LTR')}
                    className={`px-1.5 py-0.5 rounded font-bold ${direction === 'LTR' ? 'bg-white text-gray-800 shadow-sm' : 'text-slate-600'}`}
                  >
                    LTR
                  </button>
                  <button 
                    type="button" 
                    onClick={() => toggleDirectionState('RTL')}
                    className={`px-1.5 py-0.5 rounded font-bold ${direction === 'RTL' ? 'bg-white text-gray-800 shadow-sm' : 'text-slate-600'}`}
                  >
                    RTL
                  </button>
                </div>

                <div className="grow"></div>

                {/* Find button */}
                <button 
                  type="button" 
                  onClick={() => setShowFindReplace(!showFindReplace)}
                  className="px-2.5 py-1.5 bg-white border border-gray-300 hover:bg-gray-100 font-semibold rounded text-gray-700 text-xs flex items-center gap-1 shadow-sm transition"
                >
                  <Search className="w-3.5 h-3.5 text-[#2c7be5]" />
                  Find/Replace
                </button>

                {/* Keyboard Shortcuts Help button */}
                <button 
                  type="button" 
                  onClick={() => setShowShortcutsHelp(true)}
                  className="px-2.5 py-1.5 bg-white border border-gray-300 hover:bg-gray-100 font-semibold rounded text-gray-700 text-xs flex items-center gap-1 shadow-sm transition"
                  title="Keyboard Shortcuts Help"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-[#2c7be5]" />
                  <span>Keys</span>
                </button>

                {/* Inline HTML Source toggle */}
                <button
                  type="button"
                  id="source-inline-toggle"
                  onClick={() => {
                    if (showInlineSource && textareaRef.current) {
                      const htmlVal = textareaRef.current.value;
                      if (htmlVal !== inlineSourceOriginalRef.current) {
                        const cleaned = cleanHTMLForQuill(htmlVal);
                        setDocumentHtml(cleaned);
                        if (quillRef.current) {
                          quillRef.current.root.innerHTML = cleaned;
                        }
                      } else {
                        // Restore raw Quill content
                        if (quillRef.current) {
                          setDocumentHtml(quillRef.current.root.innerHTML);
                        }
                      }
                    } else {
                      // Formatting before entering inline editor
                      const currentVal = quillRef.current ? quillRef.current.root.innerHTML : documentHtml;
                      const sanitized = preCleanHTML(currentVal);
                      const formatted = formatHTML(sanitized);
                      inlineSourceOriginalRef.current = formatted;
                      setDocumentHtml(formatted);
                    }
                    setShowInlineSource(!showInlineSource);
                  }}
                  className={`px-3 py-1.5 rounded text-xs font-bold transition flex items-center gap-1 shadow-sm border ${
                    showInlineSource 
                      ? 'border-[#2c7be5] bg-[#e2effe] text-[#2c7be5] shadow-inner' 
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Code className="w-3.5 h-3.5" />
                  {showInlineSource ? 'WYSIWYG View' : '<> Code Inline'}
                </button>
              </div>

              {/* Find & Replace Panel */}
              {showFindReplace && (
                <div id="inline-find-replace-panel-dock" className="bg-[#f8f9fa] border-b border-gray-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs shadow-inner">
                  <div className="flex flex-wrap gap-3 items-center">
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-500 font-semibold select-none">Find:</span>
                      <input 
                        type="text" 
                        value={findText}
                        onChange={(e) => setFindText(e.target.value)}
                        placeholder="Search word..." 
                        className="bg-white border border-gray-350 p-1.5 rounded w-40 outline-none focus:border-[#2c7be5] text-gray-800 focus:ring-1 focus:ring-[#2c7be5]"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-500 font-semibold select-none">Replace:</span>
                      <input 
                        type="text" 
                        value={replaceText}
                        onChange={(e) => setReplaceText(e.target.value)}
                        placeholder="Replace with..." 
                        className="bg-white border border-gray-350 p-1.5 rounded w-40 outline-none focus:border-[#2c7be5] text-gray-800 focus:ring-1 focus:ring-[#2c7be5]"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 ml-2">
                      <button type="button" onClick={() => handleFindReplace('find')} className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 rounded font-semibold text-gray-700 transition">Find Matches</button>
                      <button type="button" onClick={() => handleFindReplace('replace')} className="px-3 py-1.5 bg-[#2c7be5] text-white hover:bg-blue-600 rounded font-bold transition">Replace Next</button>
                      <button type="button" onClick={() => handleFindReplace('replaceAll')} className="px-3 py-1.5 bg-amber-600 text-white hover:bg-amber-700 rounded font-bold transition">Replace All</button>
                    </div>
                  </div>
                  <button onClick={() => setShowFindReplace(false)} className="text-gray-400 hover:text-gray-650 font-bold text-sm select-none">&times;</button>
                </div>
              )}

              {/* Editable Area */}
              <div className="flex-grow p-4 md:p-6 relative bg-white" id="wysiwyg-box-view">
                <div
                  ref={editorRef}
                  id="editable-html-wysiwyg"
                  className={`editor-content w-full min-h-[420px] outline-none ${showInlineSource ? 'hidden' : 'block'}`}
                  dir={direction.toLowerCase()}
                  style={{ textAlign: direction === 'RTL' ? 'right' : 'left' }}
                />

                {showInlineSource && (
                  <textarea
                    ref={textareaRef}
                    onChange={(e) => {
                      setDocumentHtml(e.target.value);
                      calculateCounters(e.target.value);
                    }}
                    className="w-full font-mono text-xs leading-6 p-4 min-h-[420px] bg-[#272822] text-[#f8f8f2] outline-none border border-gray-300 rounded-md block resize-y overflow-auto font-medium"
                    value={documentHtml}
                    placeholder="Enter raw HTML codes here..."
                  />
                )}
              </div>

              {/* Counts and Directions Bottom Header Footer */}
              <footer className="flex justify-between items-center text-xs text-gray-500 bg-[#f8f9fa] border-t border-[#dee2e6] px-4 py-3">
                <div className="flex items-center gap-1.5 select-none font-semibold">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  Detected layout direction: <span className="font-bold text-gray-700 uppercase pr-1">{direction}</span>
                  <span className="text-[10px] text-gray-400 font-normal">({"Auto-detected range matches"})</span>
                </div>
                <div className="flex gap-4 font-mono select-none" id="word-count-dock">
                  <span>Words: <strong className="text-gray-700">{wordCount}</strong></span>
                  <span>Characters: <strong className="text-gray-700">{charCount}</strong></span>
                </div>
              </footer>

            </div>
          
          {/* TAB 2: HTML SOURCES CODE EDITOR */}
          <div 
            id="tab-html-panel-content" 
            className={`flex flex-col flex-grow ${activeTab === 'html' ? '' : 'hidden'}`}
          >
              
              {/* Output Option Header Row */}
              <div className="flex justify-between items-center bg-[#f8f9fa] border-b border-[#dee2e6] p-4 flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-slate-200 text-slate-700 px-2.5 py-1 rounded select-none font-semibold shadow-none">Output HTML Serializations</span>
                  
                  {hasCleanedHistory && (
                    <button 
                      onClick={undoHtmlClean}
                      className="px-2.5 py-1 border border-amber-600 bg-amber-50 text-amber-800 text-xs font-semibold rounded hover:bg-amber-100 flex items-center transition cursor-pointer"
                      title="Undo the last clean filters applied"
                    >
                      <RotateCcw className="w-3 h-3 mr-1" />
                      Undo last clean
                    </button>
                  )}
                </div>

                {/* Clean Trigger menu */}
                <div className="relative" ref={cleanPanelRef}>
                  <button
                    id="clean-options-popover-trigger"
                    onClick={() => setShowCleanOptions(!showCleanOptions)}
                    className="px-4 py-2 bg-[#2c7be5] hover:bg-blue-650 text-white font-bold rounded-md text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                    Clean HTML Options
                  </button>                  {showCleanOptions && (
                    <div id="clean-options-card-popover" className="absolute right-0 mt-2 w-[420px] max-w-[calc(100vw-2.5rem)] bg-white border border-[#dee2e6] rounded-lg shadow-2xl z-50 text-xs text-left overflow-hidden flex flex-col">
                      
                      <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex justify-between items-center select-none">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Advanced Clean Options</span>
                        <button
                          onClick={toggleAllCheckboxes}
                          className="px-2 py-1 bg-white hover:bg-gray-100 text-gray-750 font-semibold rounded border border-gray-300 text-[10px] transition cursor-pointer"
                        >
                          {Object.values(cleanOptions).every(Boolean) ? 'Deselect All' : 'Select All'}
                        </button>
                      </div>

                      {/* Scroller parameters checklists */}
                      <div className="p-4 max-h-[380px] overflow-y-auto space-y-4">
                        
                        {/* 1. Office & Google Docs Markup */}
                        <div className="flex items-start gap-3">
                          <input 
                            type="checkbox" 
                            id="check-office-gdocs"
                            checked={cleanOptions.officeGdocsMarkup}
                            onChange={(e) => setCleanOptions(prev => ({ ...prev, officeGdocsMarkup: e.target.checked }))}
                            className="accent-[#2c7be5] h-4 w-4 mt-0.5 rounded border-gray-300 cursor-pointer shrink-0" 
                          />
                          <div>
                            <label htmlFor="check-office-gdocs" className="font-bold text-gray-700 hover:text-gray-900 cursor-pointer block text-xs">
                              Office & Google Docs Markup
                            </label>
                            <p className="text-gray-500 text-[11px] leading-normal font-sans">
                              Microsoft mso- properties, o:p tags, conditional comments, and Google Docs specific ids/injected tags.
                            </p>
                          </div>
                        </div>

                        {/* 2. Remove style="" attributes */}
                        <div className="flex items-start gap-3">
                          <input 
                            type="checkbox" 
                            id="check-all-styles"
                            checked={cleanOptions.allStyles}
                            onChange={(e) => setCleanOptions(prev => ({ ...prev, allStyles: e.target.checked }))}
                            className="accent-[#2c7be5] h-4 w-4 mt-0.5 rounded border-gray-300 cursor-pointer shrink-0" 
                          />
                          <div>
                            <label htmlFor="check-all-styles" className="font-bold text-gray-700 hover:text-gray-900 cursor-pointer block text-xs">
                              Remove style="" attributes
                            </label>
                            <p className="text-gray-500 text-[11px] leading-normal font-sans">
                              Strips all inline styles and styling tags from HTML elements.
                            </p>
                          </div>
                        </div>

                        {/* 3. Remove class="" attributes */}
                        <div className="flex items-start gap-3">
                          <input 
                            type="checkbox" 
                            id="check-classes"
                            checked={cleanOptions.classes}
                            onChange={(e) => setCleanOptions(prev => ({ ...prev, classes: e.target.checked }))}
                            className="accent-[#2c7be5] h-4 w-4 mt-0.5 rounded border-gray-300 cursor-pointer shrink-0" 
                          />
                          <div>
                            <label htmlFor="check-classes" className="font-bold text-gray-700 hover:text-gray-900 cursor-pointer block text-xs">
                              Remove class="" attributes
                            </label>
                            <p className="text-gray-500 text-[11px] leading-normal font-sans">
                              Strips class names from all HTML elements.
                            </p>
                          </div>
                        </div>

                        {/* 4. Remove id="" attributes */}
                        <div className="flex items-start gap-3">
                          <input 
                            type="checkbox" 
                            id="check-ids"
                            checked={cleanOptions.ids}
                            onChange={(e) => setCleanOptions(prev => ({ ...prev, ids: e.target.checked }))}
                            className="accent-[#2c7be5] h-4 w-4 mt-0.5 rounded border-gray-300 cursor-pointer shrink-0" 
                          />
                          <div>
                            <label htmlFor="check-ids" className="font-bold text-gray-700 hover:text-gray-900 cursor-pointer block text-xs">
                              Remove id="" attributes
                            </label>
                            <p className="text-gray-500 text-[11px] leading-normal font-sans">
                              Strips unique element IDs from all tags.
                            </p>
                          </div>
                        </div>

                        {/* 5. Remove data-* attributes */}
                        <div className="flex items-start gap-3">
                          <input 
                            type="checkbox" 
                            id="check-data-attrs"
                            checked={cleanOptions.dataAttrs}
                            onChange={(e) => setCleanOptions(prev => ({ ...prev, dataAttrs: e.target.checked }))}
                            className="accent-[#2c7be5] h-4 w-4 mt-0.5 rounded border-gray-300 cursor-pointer shrink-0" 
                          />
                          <div>
                            <label htmlFor="check-data-attrs" className="font-bold text-gray-700 hover:text-gray-900 cursor-pointer block text-xs">
                              Remove data-* attributes
                            </label>
                            <p className="text-gray-500 text-[11px] leading-normal font-sans">
                              Removes all custom data storage attributes (e.g., data-list-item).
                            </p>
                          </div>
                        </div>

                        {/* 6. Remove aria-* attributes */}
                        <div className="flex items-start gap-3">
                          <input 
                            type="checkbox" 
                            id="check-aria-attrs"
                            checked={cleanOptions.ariaAttrs}
                            onChange={(e) => setCleanOptions(prev => ({ ...prev, ariaAttrs: e.target.checked }))}
                            className="accent-[#2c7be5] h-4 w-4 mt-0.5 rounded border-gray-300 cursor-pointer shrink-0" 
                          />
                          <div>
                            <label htmlFor="check-aria-attrs" className="font-bold text-gray-700 hover:text-gray-900 cursor-pointer block text-xs">
                              Remove aria-* attributes
                            </label>
                            <p className="text-gray-500 text-[11px] leading-normal font-sans">
                              Removes accessibility annotations from all tags.
                            </p>
                          </div>
                        </div>

                        {/* 7. Remove HTML comments */}
                        <div className="flex items-start gap-3">
                          <input 
                            type="checkbox" 
                            id="check-comments"
                            checked={cleanOptions.comments}
                            onChange={(e) => setCleanOptions(prev => ({ ...prev, comments: e.target.checked }))}
                            className="accent-[#2c7be5] h-4 w-4 mt-0.5 rounded border-gray-300 cursor-pointer shrink-0" 
                          />
                          <div>
                            <label htmlFor="check-comments" className="font-bold text-gray-700 hover:text-gray-900 cursor-pointer block text-xs">
                              Remove HTML comments
                            </label>
                            <p className="text-gray-500 text-[11px] leading-normal font-sans">
                              Removes regular HTML developer comments.
                            </p>
                          </div>
                        </div>

                        {/* 8. Remove empty tags */}
                        <div className="flex items-start gap-3">
                          <input 
                            type="checkbox" 
                            id="check-empty-tags"
                            checked={cleanOptions.emptyTags}
                            onChange={(e) => setCleanOptions(prev => ({ ...prev, emptyTags: e.target.checked }))}
                            className="accent-[#2c7be5] h-4 w-4 mt-0.5 rounded border-gray-300 cursor-pointer shrink-0" 
                          />
                          <div>
                            <label htmlFor="check-empty-tags" className="font-bold text-gray-700 hover:text-gray-900 cursor-pointer block text-xs">
                              Remove empty tags
                            </label>
                            <p className="text-gray-550 text-[11px] leading-normal font-sans">
                              Only deletes empty &lt;p&gt;&lt;/p&gt; and &lt;span&gt;&lt;/span&gt; tags with no content. Never removes structural tags.
                            </p>
                          </div>
                        </div>

                        {/* 9. Remove <br> inside block elements */}
                        <div className="flex items-start gap-3">
                          <input 
                            type="checkbox" 
                            id="check-br-block"
                            checked={cleanOptions.brInsideBlock}
                            onChange={(e) => setCleanOptions(prev => ({ ...prev, brInsideBlock: e.target.checked }))}
                            className="accent-[#2c7be5] h-4 w-4 mt-0.5 rounded border-gray-300 cursor-pointer shrink-0" 
                          />
                          <div>
                            <label htmlFor="check-br-block" className="font-bold text-gray-700 hover:text-gray-900 cursor-pointer block text-xs">
                              Remove &lt;br&gt; inside block elements
                            </label>
                            <p className="text-gray-500 text-[11px] leading-normal font-sans">
                              Removes manual break tags inside blocks like p, h1-h6, and li elements.
                            </p>
                          </div>
                        </div>

                        {/* 10. Remove link target attributes */}
                        <div className="flex items-start gap-3">
                          <input 
                            type="checkbox" 
                            id="check-remove-targets"
                            checked={cleanOptions.removeTargets}
                            onChange={(e) => setCleanOptions(prev => ({ ...prev, removeTargets: e.target.checked }))}
                            className="accent-[#2c7be5] h-4 w-4 mt-0.5 rounded border-gray-300 cursor-pointer shrink-0" 
                          />
                          <div>
                            <label htmlFor="check-remove-targets" className="font-bold text-gray-700 hover:text-gray-900 cursor-pointer block text-xs">
                              Remove link target attributes
                            </label>
                            <p className="text-gray-500 text-[11px] leading-normal font-sans">
                              Strips target="_blank" and other target configurations from links.
                            </p>
                          </div>
                        </div>

                        {/* 11. Remove link rel attributes */}
                        <div className="flex items-start gap-3">
                          <input 
                            type="checkbox" 
                            id="check-remove-rels"
                            checked={cleanOptions.removeRels}
                            onChange={(e) => setCleanOptions(prev => ({ ...prev, removeRels: e.target.checked }))}
                            className="accent-[#2c7be5] h-4 w-4 mt-0.5 rounded border-gray-300 cursor-pointer shrink-0" 
                          />
                          <div>
                            <label htmlFor="check-remove-rels" className="font-bold text-gray-700 hover:text-gray-900 cursor-pointer block text-xs">
                              Remove link rel attributes
                            </label>
                            <p className="text-gray-500 text-[11px] leading-normal font-sans">
                              Strips rel attributes (e.g., noopener, noreferrer) from links.
                            </p>
                          </div>
                        </div>

                        {/* 12. Remove table width, height, cellpadding, cellspacing, border attributes */}
                        <div className="flex items-start gap-3">
                          <input 
                            type="checkbox" 
                            id="check-table-attrs"
                            checked={cleanOptions.tableAttrs}
                            onChange={(e) => setCleanOptions(prev => ({ ...prev, tableAttrs: e.target.checked }))}
                            className="accent-[#2c7be5] h-4 w-4 mt-0.5 rounded border-gray-300 cursor-pointer shrink-0" 
                          />
                          <div>
                            <label htmlFor="check-table-attrs" className="font-bold text-gray-700 hover:text-gray-900 cursor-pointer block text-xs">
                              Remove table dimensions & border attributes
                            </label>
                            <p className="text-gray-500 text-[11px] leading-normal font-sans">
                              Strips fixed width, height, cellpadding, cellspacing, and border parameters from tables.
                            </p>
                          </div>
                        </div>

                      </div>

                      {/* Clean popover actions */}
                      <div className="p-3 bg-gray-50 border-t border-gray-200 flex gap-2 select-none">
                        <button 
                          onClick={resetCheckboxes} 
                          className="flex-1 py-1.5 border border-gray-300 hover:bg-gray-100 text-xs font-bold text-gray-600 rounded cursor-pointer"
                        >
                          Reset Defaults
                        </button>
                        <button 
                          onClick={() => setShowCleanOptions(false)} 
                          className="px-3 py-1.5 hover:bg-gray-100 font-bold text-gray-650 text-xs rounded cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={runHTMLCleaning} 
                          className="flex-1 py-1.5 bg-[#2c7be5] hover:bg-blue-650 text-white text-xs font-bold rounded shadow-sm cursor-pointer"
                        >
                          Clean Now
                        </button>
                      </div>

                    </div>
                  )}
                </div>
              </div>

              {/* Code Editor Layout */}
              <div className="border-t border-[#dee2e6] bg-[#1e1f1c] flex min-h-[440px] max-h-[600px] relative flex-grow overflow-hidden">
                
                {/* Dynamically Styled Line Numbers column */}
                <div 
                  id="code-lines-sidebar"
                  className="w-12 bg-[#1b1c19] border-r border-[#2d2e2a] py-4 text-right pr-3 select-none text-[#5c6370] font-mono text-[11px] leading-6 overflow-hidden max-h-[600px]"
                >
                  {lineCountArray.map(ln => (
                    <div key={ln}>{ln}</div>
                  ))}
                </div>

                {/* Main input HTML textarea */}
                <div className="grow relative flex">
                  <textarea
                    ref={htmlTextareaRef}
                    value={documentHtml}
                    onChange={(e) => {
                      setDocumentHtml(e.target.value);
                      calculateCounters(e.target.value);
                      setHtmlIsDirty(true);
                    }}
                    className="w-full h-full bg-transparent text-[#f8f8f2] font-mono text-[13px] leading-6 p-4 outline-none border-0 block resize-none z-10 whitespace-pre overflow-auto font-medium"
                    style={{ caretColor: 'white' }}
                  />
                </div>
              </div>

            </div>

        </div>

        {/* Global Export Row bar below editor panels */}
        <div className="bg-white border border-[#dee2e6] rounded-lg p-5 shadow-subtle min-h-[80px] mt-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-xs text-gray-500 max-w-md md:leading-relaxed select-none font-medium">
            The output clean structured HTML integrates directly inside WordPress Gutenberg blocks, Wix, Shopify pages, classic emails, or custom CSS pipelines.
          </div>
          <div className="flex flex-wrap gap-2 justify-end w-full md:w-auto">
            {/* Copy HTML */}
            <button
              id="copy-html-btn"
              onClick={handleCopyHTML}
              className="px-4 py-2 border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 font-bold text-xs flex items-center gap-1.5 rounded-md shadow-sm transition cursor-pointer"
              title="Copy resulting HTML code"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy HTML
            </button>
            {/* Copy Text */}
            <button
              id="copy-text-btn"
              onClick={handleCopyText}
              className="px-4 py-2 border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 font-bold text-xs flex items-center gap-1.5 rounded-md shadow-sm transition cursor-pointer"
              title="Copy text content ignoring tag wrappers"
            >
              <FileText className="w-3.5 h-3.5 text-gray-500" />
              Copy Plain Text
            </button>
            {/* Download .html */}
            <button
              id="download-html-btn"
              onClick={downloadHtmlDocument}
              className="px-4 py-2 border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 font-bold text-xs flex items-center gap-1.5 rounded-md shadow-sm transition cursor-pointer"
              title="Download compiled HTML document"
            >
              <Download className="w-3.5 h-3.5" />
              Download .html
            </button>
            {/* Download .txt */}
            <button
              id="download-txt-btn"
              onClick={downloadTextDocument}
              className="px-4 py-2 bg-[#2c7be5] hover:bg-blue-605 text-white rounded-md font-bold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
              title="Download clean plain text format file"
            >
              <FileCode className="w-3.5 h-3.5" />
              Download .txt
            </button>
          </div>
        </div>

      </main>

      {/* Dynamic Floating Context Menu on clicking tables td/th */}
      {contextMenu.visible && (
        <div
          ref={tableContextMenuRef}
          className="absolute bg-white border border-gray-200 shadow-2xl rounded-md py-1.5 w-52 z-50 text-[11px] font-semibold text-gray-700"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <p className="px-3 py-1 text-[9px] text-gray-400 uppercase tracking-widest select-none border-b border-gray-100 mb-1 font-bold">Row Column Controls</p>
          <button onClick={() => runTableAction('addRowAbove')} className="w-full text-left px-3 py-1.5 hover:bg-[#e2effe] hover:text-[#2c7be5] flex items-center gap-1.5 transition cursor-pointer">Insert Row Above</button>
          <button onClick={() => runTableAction('addRowBelow')} className="w-full text-left px-3 py-1.5 hover:bg-[#e2effe] hover:text-[#2c7be5] flex items-center gap-1.5 transition cursor-pointer">Insert Row Below</button>
          <button onClick={() => runTableAction('deleteRow')} className="w-full text-left px-3 py-1.5 hover:bg-red-50 hover:text-red-600 flex items-center gap-1.5 border-b border-gray-100 transition cursor-pointer">Delete Row</button>
          <button onClick={() => runTableAction('addColumnLeft')} className="w-full text-left px-3 py-1.5 hover:bg-[#e2effe] hover:text-[#2c7be5] flex items-center gap-1.5 transition cursor-pointer">Insert Column Left</button>
          <button onClick={() => runTableAction('addColumnRight')} className="w-full text-left px-3 py-1.5 hover:bg-[#e2effe] hover:text-[#2c7be5] flex items-center gap-1.5 transition cursor-pointer">Insert Column Right</button>
          <button onClick={() => runTableAction('deleteColumn')} className="w-full text-left px-3 py-1.5 hover:bg-red-50 hover:text-red-600 flex items-center gap-1.5 border-b border-gray-100 transition cursor-pointer">Delete Column</button>
          <button onClick={() => runTableAction('mergeCells')} className="w-full text-left px-3 py-1.5 hover:bg-[#e2effe] hover:text-[#2c7be5] flex items-center gap-1.5 transition cursor-pointer">Merge Cells (Span Column)</button>
          <button onClick={() => runTableAction('splitCell')} className="w-full text-left px-3 py-1.5 hover:bg-[#e2effe] hover:text-[#2c7be5] flex items-center gap-1.5 transition cursor-pointer">Split / Reset cell</button>
        </div>
      )}

      {/* Keyboard Shortcuts Help Modal */}
      {showShortcutsHelp && (
        <div 
          id="shortcuts-help-modal" 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all duration-300"
          onClick={() => setShowShortcutsHelp(false)}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-gray-100 overflow-hidden transform scale-100 transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-sidebar bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-[#2c7be5]" />
                <h3 className="font-bold text-gray-805 text-sm">Keyboard Shortcuts</h3>
              </div>
              <button 
                type="button"
                onClick={() => setShowShortcutsHelp(false)}
                className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-5 space-y-3.5">
              <p className="text-xs text-gray-500 mb-1">
                Maximize editing efficiency with these instant editor controls:
              </p>
              
              <div className="grid grid-cols-1 gap-2">
                {[
                  { keys: ['Ctrl', 'Z'], desc: 'Undo last change' },
                  { keys: ['Ctrl', 'Y'], desc: 'Redo undone change' },
                  { keys: ['Ctrl', 'B'], desc: 'Toggle bold' },
                  { keys: ['Ctrl', 'I'], desc: 'Toggle italic' },
                  { keys: ['Ctrl', 'U'], desc: 'Toggle underline' },
                  { keys: ['Ctrl', 'K'], desc: 'Insert hyperlink' },
                  { keys: ['Ctrl', 'H'], desc: 'Open Find & Replace' },
                  { keys: ['Ctrl', 'A'], desc: 'Select all content' }
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 px-1 rounded transition">
                    <span className="text-xs text-gray-600 font-medium">{item.desc}</span>
                    <div className="flex items-center gap-1.5 select-none text-[10px] font-semibold text-gray-750">
                      {item.keys.map((k, kIdx) => (
                        <kbd 
                          key={kIdx} 
                          className="bg-slate-100 text-slate-800 text-[10px] px-2 py-0.5 rounded border border-slate-250 shadow-sm"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button 
                type="button"
                onClick={() => setShowShortcutsHelp(false)}
                className="px-4 py-1.5 bg-[#2c7be5] hover:bg-blue-600 text-white rounded font-bold text-xs transition shadow-sm"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Styled Popup Toast notifications */}
      {showToast && (
        <div id="toast-notif" className="fixed bottom-5 right-5 bg-gray-900 border border-gray-800 text-white font-semibold text-xs px-4 py-3 rounded-lg shadow-2xl transition duration-300 z-50 flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded bg-emerald-400 animate-ping"></div>
          <span>{toastText}</span>
        </div>
      )}

    </div>
  );
}

// Custom simple icon component fallback
function FileCode(props: any) {
  return (
    <svg
      {...props}
      className={props.className || "w-4 h-4"}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.244 2.14a4.5 4.5 0 016.364 6.364L8.743 20.368a4.5 4.5 0 11-6.364-6.364L14.244 2.14z" />
    </svg>
  );
}
