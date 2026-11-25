import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react';

export function AutoTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const resize = () => {
    const element = ref.current;
    if (!element || !element.clientWidth) return;
    element.style.height = '0px';
    const border = element.offsetHeight - element.clientHeight;
    element.style.height = `${element.scrollHeight + border}px`;
  };
  useLayoutEffect(resize, [props.value, props.style]);
  useLayoutEffect(() => {
    const element = ref.current!;
    let width = 0;
    const observer = new ResizeObserver(() => {
      if (element.clientWidth === width) return;
      width = element.clientWidth;
      resize();
    });
    observer.observe(element);
    let active = true;
    void document.fonts.ready.then(() => {
      if (active) resize();
    });
    return () => {
      active = false;
      observer.disconnect();
    };
  }, []);
  return (
    <textarea
      {...props}
      ref={ref}
      style={{ ...props.style, resize: 'none', overflowY: 'hidden' }}
    />
  );
}
