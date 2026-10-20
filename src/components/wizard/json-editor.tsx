"use client";

import { useMemo } from "react";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";

export interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  invalid?: boolean;
  readOnly?: boolean;
  height?: string;
}

/**
 * CodeMirror is loaded through next/dynamic so the landing page never pays for
 * the editor bundle. The inner content element carries the accessible label and
 * the invalid state so screen readers announce the text area itself.
 */
export default function JsonEditor({
  value,
  onChange,
  ariaLabel,
  invalid = false,
  readOnly = false,
  height = "360px",
}: JsonEditorProps) {
  const extensions = useMemo(
    () => [
      json(),
      EditorView.contentAttributes.of({
        "aria-label": ariaLabel,
        "aria-invalid": invalid ? "true" : "false",
      }),
    ],
    [ariaLabel, invalid],
  );

  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-[#0b0b0e] text-sm focus-within:border-lime-300/50">
      <CodeMirror
        value={value}
        height={height}
        theme="dark"
        readOnly={readOnly}
        extensions={extensions}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: false,
        }}
        onChange={onChange}
      />
    </div>
  );
}
