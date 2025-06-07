import React, { useState, useEffect } from 'react';

interface TypewriterEffectProps {
  text: string;
  delay?: number;
  onComplete?: () => void;
}

const TypewriterEffect: React.FC<TypewriterEffectProps> = ({ text, delay = 50, onComplete }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText(prevText => prevText + text[currentIndex]);
        setCurrentIndex(prevIndex => prevIndex + 1);
      }, delay);
      return () => clearTimeout(timeout);
    } else {
      if (onComplete) {
        onComplete();
      }
    }
  }, [text, currentIndex, delay, onComplete]);

  return <>{displayedText}</>;
};

export default TypewriterEffect; 