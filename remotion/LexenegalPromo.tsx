import React from 'react';
import { AbsoluteFill } from 'remotion';
import { MemoryRouter } from 'react-router-dom';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';

import '../src/styles/tokens.css';
import './video.css';

import { SCENES, TRANSITION } from './theme';
import S0Intro from './scenes/S0Intro';
import S1Search from './scenes/S1Search';
import S2Codes from './scenes/S2Codes';
import S3Compare from './scenes/S3Compare';
import S4Jurisprudence from './scenes/S4Jurisprudence';
import S5Graph from './scenes/S5Graph';
import S6Doctrine from './scenes/S6Doctrine';
import S7Pdf from './scenes/S7Pdf';
import S8Mcp from './scenes/S8Mcp';
import S9Outro from './scenes/S9Outro';

const timing = linearTiming({ durationInFrames: TRANSITION });

const LexenegalPromo: React.FC = () => (
  <AbsoluteFill style={{ background: '#FFFFFF' }}>
    {/* MemoryRouter : satisfait les <Link> des composants applicatifs réels. */}
    <MemoryRouter>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={SCENES.intro}>
          <S0Intro />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={timing} />

        <TransitionSeries.Sequence durationInFrames={SCENES.search}>
          <S1Search />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: 'from-right' })} timing={timing} />

        <TransitionSeries.Sequence durationInFrames={SCENES.codes}>
          <S2Codes />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={timing} />

        <TransitionSeries.Sequence durationInFrames={SCENES.compare}>
          <S3Compare />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: 'from-bottom' })} timing={timing} />

        <TransitionSeries.Sequence durationInFrames={SCENES.jurisprudence}>
          <S4Jurisprudence />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={timing} />

        <TransitionSeries.Sequence durationInFrames={SCENES.graph}>
          <S5Graph />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={timing} />

        <TransitionSeries.Sequence durationInFrames={SCENES.doctrine}>
          <S6Doctrine />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: 'from-right' })} timing={timing} />

        <TransitionSeries.Sequence durationInFrames={SCENES.pdf}>
          <S7Pdf />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={timing} />

        <TransitionSeries.Sequence durationInFrames={SCENES.mcp}>
          <S8Mcp />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={timing} />

        <TransitionSeries.Sequence durationInFrames={SCENES.outro}>
          <S9Outro />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </MemoryRouter>
  </AbsoluteFill>
);

export default LexenegalPromo;
