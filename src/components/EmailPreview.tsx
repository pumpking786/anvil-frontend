import { Fragment } from 'react';
import { safeImageSource } from '../lib/imagePolicy.mjs';
// Templates are text with bold/italic marks, so render React nodes instead of HTML.
function Text({ value }: { value: string }) {
  return (
    <>
      {String(value)
        .split('\n')
        .map((line, index) => (
          <Fragment key={index}>
            {index > 0 && <br />}
            {(line.startsWith('- ') ? '• ' + line.slice(2) : line)
              .split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g)
              .map((part, i) =>
                part.startsWith('**') && part.endsWith('**') ? (
                  <strong key={i}>{part.slice(2, -2)}</strong>
                ) : part.startsWith('*') && part.endsWith('*') ? (
                  <em key={i}>{part.slice(1, -1)}</em>
                ) : (
                  part
                ),
              )}
          </Fragment>
        ))}
    </>
  );
}
export function EmailPreview({
  content,
}: {
  content: {
    message: string;
    signature?: string;
    logo?: string;
    color?: string;
    align?: string;
    font?: string;
  };
}) {
  const { message, signature, logo, color = '', align, font } = content;
  const source = safeImageSource(logo);
  return (
    <div
      className="email-preview-paper"
      style={{
        fontFamily: ['Arial', 'Georgia', 'Verdana'].includes(font || '') ? font : 'Arial',
        fontSize: 15,
        lineHeight: 1.65,
        color: /^#[0-9a-f]{6}$/i.test(color) ? color : '#243247',
        textAlign: align === 'center' || align === 'right' ? align : 'left',
      }}
    >
      <Text value={message} />
      {signature && (
        <div style={{ marginTop: 24 }}>
          <Text value={signature} />
        </div>
      )}
      {source && (
        <div style={{ marginTop: 12 }}>
          <img
            src={source}
            alt="Signature logo"
            width={160}
            style={{ maxWidth: '100%', height: 'auto' }}
          />
        </div>
      )}
    </div>
  );
}
