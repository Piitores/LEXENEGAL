import React from 'react';
import { Composition } from 'remotion';
import LexenegalPromo from './LexenegalPromo';
import { FPS, TOTAL_DURATION } from './theme';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="LexenegalPromo"
    component={LexenegalPromo}
    durationInFrames={TOTAL_DURATION}
    fps={FPS}
    width={1920}
    height={1080}
  />
);
