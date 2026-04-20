/**
 * SchemaInjector — Injects JSON-LD structured data into <head>.
 * Use on any page that needs schema markup.
 */
import { useEffect } from "react";

export default function SchemaInjector({ id, schema }) {
  useEffect(() => {
    if (!schema) return;
    let script = document.getElementById(id);
    if (!script) {
      script = document.createElement("script");
      script.id = id;
      script.type = "application/ld+json";
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(schema);
    return () => {
      const el = document.getElementById(id);
      if (el) el.remove();
    };
  }, [id, JSON.stringify(schema)]);

  return null;
}