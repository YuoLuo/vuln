'use client';

import React from 'react';
import DOMPurify from 'isomorphic-dompurify';

interface SafeHtmlRendererProps {
  content: string;
  className?: string;
  allowImages?: boolean;
  allowLinks?: boolean;
}

/**
 * 安全的HTML渲染组件
 * 使用DOMPurify清理HTML内容，防止XSS攻击
 */
export const SafeHtmlRenderer: React.FC<SafeHtmlRendererProps> = ({ 
  content, 
  className = "prose max-w-none",
  allowImages = true,
  allowLinks = true
}) => {
  const cleanHtml = React.useMemo(() => {
    if (!content || typeof content !== 'string') return '';
    
    // 配置允许的标签和属性
    const allowedTags = [
      'p', 'br', 'strong', 'em', 'u', 'ol', 'ul', 'li', 
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
      'blockquote', 'code', 'pre'
    ];
    
    const allowedAttributes = ['class'];
    
    // 根据配置添加图片和链接支持
    if (allowImages) {
      allowedTags.push('img');
      allowedAttributes.push('src', 'alt', 'width', 'height');
    }
    
    if (allowLinks) {
      allowedTags.push('a');
      allowedAttributes.push('href', 'target', 'rel');
    }
    
    return DOMPurify.sanitize(content, {
      ALLOWED_TAGS: allowedTags,
      ALLOWED_ATTR: allowedAttributes,
      FORBID_ATTR: ['style', 'onclick', 'onload', 'onerror', 'onmouseover'],
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
      KEEP_CONTENT: true,
      ADD_ATTR: ['target'],
      ADD_TAGS: [],
      CUSTOM_ELEMENT_HANDLING: {
        tagNameCheck: null,
        attributeNameCheck: null,
        allowCustomizedBuiltInElements: false,
      }
    });
  }, [content, allowImages, allowLinks]);

  if (!cleanHtml) {
    return <div className="text-gray-400 italic">暂无内容</div>;
  }

  return (
    <div 
      className={className}
      dangerouslySetInnerHTML={{ __html: cleanHtml }}
      style={{
        // 确保代码块样式正确
        wordBreak: 'break-word',
        overflowWrap: 'break-word'
      }}
    />
  );
};

export default SafeHtmlRenderer;