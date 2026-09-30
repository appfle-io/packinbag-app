// 리디자인 v2 전용 ESLint 규칙.
// components/v2/**, app/dev/** 에만 적용한다(eslint.config.mjs). 구 UI 코드는 검사하지 않는다.
//
// no-arbitrary-values: className 문자열에서 디자인 토큰 밖의 값을 막는다.
//   - 임의값: text-[12.5px], bg-[#fff], p-[7px] ... (transition-[속성목록]은 값이 아니라 대상 지정이라 허용)
//   - 간격의 반 단계: p-1.5, gap-2.5, mt-0.5 ... (4pt 단위만 허용)
//   - Tailwind 기본 글자/모서리/그림자/팔레트: text-sm, rounded-lg, shadow-md, bg-gray-100 ...
//     -> v2 토큰(text-body, rounded-card, shadow-sheet, bg-fill ...)을 쓴다.
//   예외가 꼭 필요하면 해당 줄에 eslint-disable-next-line 과 이유를 남긴다.
//
// no-static-inline-style: 값이 전부 리터럴인 style={{...}}를 막는다.
//   진행률 width처럼 런타임에 계산되는 값만 style로 넘긴다.

const SPACING = "(?:p|px|py|pt|pb|pl|pr|ps|pe|m|mx|my|mt|mb|ml|mr|ms|me|gap|gap-x|gap-y|space-x|space-y|inset|inset-x|inset-y|top|left|right|bottom|start|end)";
const PALETTE = "(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)";

const CHECKS = [
  { re: /(?:^|[\s:!])-?(?!transition-\[)[a-z][a-z0-9-]*-\[[^\]\s]+\]/, msg: "임의값([...]) 대신 v2 토큰을 쓰세요." },
  { re: new RegExp(`(?:^|[\\s:!])-?${SPACING}-\\d+\\.5(?=\\s|$)`), msg: "간격은 4pt 단위만 씁니다(0.5/1.5/2.5 같은 반 단계 금지)." },
  { re: /(?:^|[\s:!])text-(?:xs|sm|base|lg|xl|[2-9]xl)(?=\s|$)/, msg: "글자 크기는 text-micro/caption/body/body-lg/heading/title 중에서 고르세요." },
  { re: /(?:^|[\s:!])rounded(?:-(?:t|b|l|r|tl|tr|bl|br|s|e|ss|se|es|ee))?-(?:xs|sm|md|lg|xl|2xl|3xl|4xl)(?=\s|$)/, msg: "모서리는 rounded-control/field/card/full 중에서 고르세요." },
  { re: /(?:^|[\s:!])rounded(?=\s|$)/, msg: "모서리는 rounded-control/field/card/full 중에서 고르세요." },
  { re: /(?:^|[\s:!])shadow(?:-(?:2xs|xs|sm|md|lg|xl|2xl|inner))?(?=\s|$)/, msg: "그림자는 shadow-sheet 하나만 씁니다." },
  { re: new RegExp(`(?:^|[\\s:!])(?:bg|text|border|ring|outline|fill|stroke|divide|from|via|to|decoration|caret|accent)-${PALETTE}-\\d{2,3}(?=[\\s/]|$)`), msg: "색은 v2 토큰(ink/sub/faint/brand/line/fill/card/canvas/alert)만 씁니다." },
];

function collectStrings(node, out) {
  if (!node) return;
  switch (node.type) {
    case "Literal":
      if (typeof node.value === "string") out.push({ node, text: node.value });
      break;
    case "TemplateLiteral":
      node.quasis.forEach((q) => out.push({ node: q, text: q.value.cooked ?? q.value.raw }));
      node.expressions.forEach((e) => collectStrings(e, out));
      break;
    case "JSXExpressionContainer":
      collectStrings(node.expression, out);
      break;
    case "ConditionalExpression":
      collectStrings(node.consequent, out);
      collectStrings(node.alternate, out);
      break;
    case "LogicalExpression":
    case "BinaryExpression":
      collectStrings(node.left, out);
      collectStrings(node.right, out);
      break;
    case "CallExpression":
      node.arguments.forEach((a) => collectStrings(a, out));
      break;
    case "ArrayExpression":
      node.elements.forEach((e) => collectStrings(e, out));
      break;
    case "ObjectExpression":
      node.properties.forEach((p) => {
        if (p.type === "Property") {
          if (p.key.type === "Literal") collectStrings(p.key, out);
          collectStrings(p.value, out);
        }
      });
      break;
    default:
      break;
  }
}

const CLASS_ATTRS = new Set(["className", "class"]);
// cx("...") 호출처럼 JSX 바깥에서 클래스를 조립하는 경우도 검사한다.
const CLASS_HELPERS = new Set(["cx", "clsx", "cn"]);

const noArbitraryValues = {
  meta: {
    type: "problem",
    docs: { description: "v2 디자인 토큰 밖의 Tailwind 값을 막는다" },
    schema: [],
  },
  create(context) {
    function check(strings) {
      for (const { node, text } of strings) {
        // 클래스 하나씩 나눠서 검사해야 한 문자열 안의 위반을 모두 보고할 수 있다.
        for (const token of text.split(/\s+/)) {
          if (!token) continue;
          for (const c of CHECKS) {
            if (c.re.test(token)) {
              context.report({ node, message: `${c.msg} (발견: "${token}")` });
              break;
            }
          }
        }
      }
    }
    return {
      JSXAttribute(node) {
        if (!CLASS_ATTRS.has(node.name.name) || !node.value) return;
        const out = [];
        collectStrings(node.value, out);
        check(out);
      },
      CallExpression(node) {
        if (node.callee.type !== "Identifier" || !CLASS_HELPERS.has(node.callee.name)) return;
        if (node.parent && node.parent.type === "JSXExpressionContainer") return; // JSXAttribute에서 이미 검사
        const out = [];
        node.arguments.forEach((a) => collectStrings(a, out));
        check(out);
      },
    };
  },
};

const noStaticInlineStyle = {
  meta: {
    type: "suggestion",
    docs: { description: "리터럴로만 이뤄진 style prop을 막는다" },
    schema: [],
  },
  create(context) {
    return {
      JSXAttribute(node) {
        if (node.name.name !== "style" || !node.value || node.value.type !== "JSXExpressionContainer") return;
        const expr = node.value.expression;
        if (expr.type !== "ObjectExpression" || expr.properties.length === 0) return;
        const allLiteral = expr.properties.every(
          (p) => p.type === "Property" && (p.value.type === "Literal" || (p.value.type === "TemplateLiteral" && p.value.expressions.length === 0)),
        );
        if (allLiteral) {
          context.report({ node, message: "고정 값은 style 대신 v2 토큰 클래스로 쓰세요. style은 런타임 계산 값에만 씁니다." });
        }
      },
    };
  },
};

const plugin = {
  meta: { name: "pib-v2" },
  rules: {
    "no-arbitrary-values": noArbitraryValues,
    "no-static-inline-style": noStaticInlineStyle,
  },
};

export default plugin;
