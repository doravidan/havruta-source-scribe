const INJECTION_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: "ignore_previous", re: /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|messages?|prompts?|rules?)/gi },
  { name: "disregard_previous", re: /disregard\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|messages?|prompts?|rules?)/gi },
  { name: "forget_previous", re: /forget\s+(all\s+)?(your\s+)?(previous|prior|above|earlier)?\s*(instructions?|messages?|prompts?|rules?)/gi },
  { name: "override_system", re: /override\s+(your\s+)?(system\s+)?(prompt|instructions?|rules?)/gi },
  { name: "you_are_now", re: /you\s+are\s+now\s+(a|an)\s+/gi },
  { name: "act_as", re: /act\s+as\s+(if\s+you\s+are\s+)?(a|an)\s+/gi },
  { name: "pretend", re: /pretend\s+(to\s+be|you\s+are)\s+/gi },
  { name: "system_prefix", re: /system\s*[:\-]\s*/gi },
  { name: "fake_delimiter_tag", re: /<\s*\/?\s*(system|assistant|user|instructions?|user_question|source_content)\s*>/gi },
  { name: "fake_delimiter_bracket", re: /\[\s*(system|assistant|instructions?)\s*\]/gi },
  { name: "he_ignore", re: /התעלם\s+מ?(כל\s+)?(ההוראות|ההנחיות|ההודעות)\s+(הקודמות|הקודמים|הקודם)?/g },
  { name: "he_forget", re: /שכח\s+(את\s+)?(כל\s+)?(ההוראות|ההנחיות)/g },
  { name: "he_you_are_now", re: /אתה\s+עכשיו\s+/g },
];

export function detectInjectionPatterns(s: string): string[] {
  const hits: string[] = [];
  for (const p of INJECTION_PATTERNS) {
    p.re.lastIndex = 0;
    if (p.re.test(s)) hits.push(p.name);
  }
  return hits;
}

export function sanitizeUserPrompt(s: string): string {
  let out = s;
  for (const p of INJECTION_PATTERNS) out = out.replace(p.re, "[filtered]");
  return out.slice(0, 1000);
}
