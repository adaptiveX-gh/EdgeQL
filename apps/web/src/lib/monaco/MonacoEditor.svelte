<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import type { editor } from 'monaco-editor';

  export let value: string = '';
  export let language: string = 'yaml';
  export let theme: string = 'vs-dark';
  export let options: editor.IStandaloneEditorConstructionOptions = {};
  export let height: string = '400px';
  export let readonly: boolean = false;

  const dispatch = createEventDispatcher<{
    change: { value: string };
    ready: { editor: editor.IStandaloneCodeEditor };
  }>();

  let container: HTMLElement;
  let editor: editor.IStandaloneCodeEditor;
  let model: editor.ITextModel;
  let monaco: any;

  const defaultOptions: editor.IStandaloneEditorConstructionOptions = {
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    fontSize: 14,
    lineHeight: 20,
    folding: true,
    lineNumbers: 'on',
    glyphMargin: false,
    lineDecorationsWidth: 10,
    lineNumbersMinChars: 3,
    wordWrap: 'on',
    automaticLayout: true,
    tabSize: 2,
    insertSpaces: true,
    readOnly: readonly,
    ...options
  };

  onMount(async () => {
    // Set Monaco Editor loader configuration to use self-hosted assets
    if (typeof window !== 'undefined') {
      window.MonacoEnvironment = {
        getWorkerUrl: function (workerId, label) {
          return `/monaco/vs/base/worker/workerMain.js`;
        }
      };
    }

    // Dynamically import Monaco Editor
    const monacoModule = await import('monaco-editor');
    monaco = monacoModule;
    
    // Register DSL language if not exists
    if (!monaco.languages.getLanguages().find(lang => lang.id === 'dsl')) {
      monaco.languages.register({ id: 'dsl' });
      
      // Define DSL syntax highlighting
      monaco.languages.setMonarchTokensProvider('dsl', {
        tokenizer: {
          root: [
            // Comments
            [/#.*$/, 'comment'],
            
            // YAML-like structure
            [/^[a-zA-Z_][a-zA-Z0-9_]*:/, 'keyword'],
            [/^\s*-\s+/, 'operator'],
            
            // Node types
            [/(DataLoaderNode|FeatureGeneratorNode|IndicatorNode|LabelingNode|BacktestNode|CrossoverSignalNode)/, 'type'],
            
            // Parameters
            [/(id|type|depends_on|params|symbol|timeframe|dataset|indicator|period|column|buy_condition|sell_condition|initial_capital|commission):/, 'attribute'],
            
            // Strings
            [/"([^"\\]|\\.)*$/, 'string.invalid'],
            [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],
            [/'([^'\\]|\\.)*$/, 'string.invalid'],
            [/'/, { token: 'string.quote', bracket: '@open', next: '@string_single' }],
            
            // Numbers
            [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
            [/\d+/, 'number'],
            
            // Boolean values
            [/\b(true|false)\b/, 'keyword.json'],
            
            // Operators
            [/[><=!]+/, 'operator'],
            
            // Brackets
            [/[\[\]]/, '@brackets'],
            [/[{}]/, '@brackets'],
          ],
          
          string: [
            [/[^\\"]+/, 'string'],
            [/\\./, 'string.escape.invalid'],
            [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }]
          ],
          
          string_single: [
            [/[^\\']+/, 'string'],
            [/\\./, 'string.escape.invalid'],
            [/'/, { token: 'string.quote', bracket: '@close', next: '@pop' }]
          ]
        }
      });

      // Configure language features
      monaco.languages.setLanguageConfiguration('dsl', {
        comments: {
          lineComment: '#'
        },
        brackets: [
          ['{', '}'],
          ['[', ']']
        ],
        autoClosingPairs: [
          { open: '{', close: '}' },
          { open: '[', close: ']' },
          { open: '"', close: '"' },
          { open: "'", close: "'" }
        ],
        surroundingPairs: [
          { open: '{', close: '}' },
          { open: '[', close: ']' },
          { open: '"', close: '"' },
          { open: "'", close: "'" }
        ],
        indentationRules: {
          increaseIndentPattern: /^.*(:\s*|:\s*\[.*\])\s*$/,
          decreaseIndentPattern: /^.*\].*$/
        }
      });
    }

    // Create editor instance
    editor = monaco.editor.create(container, {
      ...defaultOptions,
      value,
      language: language === 'dsl' ? 'dsl' : language,
      theme
    });

    model = editor.getModel()!;

    // Listen for content changes
    model.onDidChangeContent(() => {
      const newValue = model.getValue();
      if (newValue !== value) {
        value = newValue;
        dispatch('change', { value: newValue });
      }
    });

    // Dispatch ready event
    dispatch('ready', { editor });

    // Handle window resize
    const handleResize = () => {
      editor.layout();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  });

  onDestroy(() => {
    if (editor) {
      editor.dispose();
    }
  });

  // Update editor value when prop changes
  $: if (editor && model && value !== model.getValue()) {
    model.setValue(value);
  }

  // Update editor theme
  $: if (editor && theme) {
    monaco.editor.setTheme(theme);
  }

  // Update editor options
  $: if (editor && options) {
    editor.updateOptions({ ...defaultOptions, ...options });
  }
</script>

<div bind:this={container} style="height: {height}; width: 100%;" class="monaco-editor-container"></div>

<style>
  :global(.monaco-editor-container .monaco-editor) {
    border-radius: 8px;
  }

  :global(.monaco-editor .margin) {
    background-color: transparent;
  }
</style>