<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import type { editor } from 'monaco-editor';

  export let value: string = '';
  export let language: string = 'yaml';
  export let theme: string = 'vs-dark';
  export let options: editor.IStandaloneEditorConstructionOptions = {};
  export let height: string = '400px';
  export let readonly: boolean = false;
  export let enableValidation: boolean = false;
  export let validationDelay: number = 1000;
  
  // Validation state
  let validationTimeout: number | null = null;
  let isValidating = false;
  let currentErrors: any[] = [];
  let currentWarnings: string[] = [];

  // Exposed methods for controlling validation
  export const setValidationErrors = (errors: any[], warnings: string[] = []) => {
    if (!editor || !monaco) return;
    
    currentErrors = errors;
    currentWarnings = warnings;
    
    // Convert errors to Monaco markers
    const markers = errors.map(error => ({
      startLineNumber: error.line || 1,
      startColumn: error.column || 1,
      endLineNumber: error.line || 1,
      endColumn: error.column ? error.column + 10 : 100,
      message: error.message,
      severity: monaco.MarkerSeverity.Error,
      source: 'DSL Validator'
    }));
    
    // Add warnings as info markers
    const warningMarkers = warnings.map((warning, index) => ({
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 1,
      endColumn: 100,
      message: warning,
      severity: monaco.MarkerSeverity.Warning,
      source: 'DSL Validator'
    }));
    
    // Set markers on the model
    monaco.editor.setModelMarkers(model, 'dsl-validation', [...markers, ...warningMarkers]);
  };

  export const clearValidationErrors = () => {
    if (!editor || !monaco) return;
    currentErrors = [];
    currentWarnings = [];
    monaco.editor.setModelMarkers(model, 'dsl-validation', []);
  };

  // Jump to line method
  export const jumpToLine = (line: number, column?: number) => {
    if (!editor) return;
    
    editor.setPosition({ lineNumber: line, column: column || 1 });
    editor.revealLineInCenter(line);
    editor.focus();
  };

  // Validation function
  const performValidation = async (content: string) => {
    if (!enableValidation || !content.trim()) {
      clearValidationErrors();
      dispatch('validation', { errors: [], warnings: [], isValid: true });
      return;
    }

    isValidating = true;
    
    try {
      // Import the validation function dynamically to avoid circular dependencies
      const { pipelineApi } = await import('../api/client.js');
      
      const result = await pipelineApi.validate(content);
      
      const errors = result.errors || [];
      const warnings = result.warnings || [];
      
      setValidationErrors(errors, warnings);
      dispatch('validation', { 
        errors, 
        warnings, 
        isValid: result.valid 
      });
    } catch (error) {
      console.error('Validation error:', error);
      // Don't show API errors as DSL validation errors
      clearValidationErrors();
      dispatch('validation', { errors: [], warnings: [], isValid: true });
    } finally {
      isValidating = false;
    }
  };

  // Debounced validation
  const scheduleValidation = (content: string) => {
    if (validationTimeout) {
      clearTimeout(validationTimeout);
    }
    
    validationTimeout = window.setTimeout(() => {
      performValidation(content);
    }, validationDelay);
  };

  const dispatch = createEventDispatcher<{
    change: { value: string };
    ready: { editor: editor.IStandaloneCodeEditor };
    validation: { errors: any[]; warnings: string[]; isValid: boolean };
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
    // MonacoEnvironment is configured globally in main.js with mock workers
    // This prevents worker fallback warnings while keeping Monaco functionality
    
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
        
        // Schedule validation if enabled
        if (enableValidation) {
          scheduleValidation(newValue);
        }
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
    if (validationTimeout) {
      clearTimeout(validationTimeout);
    }
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