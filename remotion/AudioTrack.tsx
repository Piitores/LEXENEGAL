import React from 'react';
import { Audio, Sequence, interpolate, staticFile } from 'remotion';
import { SCENE_STARTS, TOTAL_DURATION } from './theme';

// Piste sonore : voix off française (ElevenLabs, un segment par scène,
// fichiers public/promo-audio/) + nappe d'ambiance bouclée à bas volume.
const VO: Array<[keyof typeof SCENE_STARTS, string, number]> = [
  ['intro', 's0.mp3', 12],
  ['search', 's1.mp3', 14],
  ['codes', 's2.mp3', 14],
  ['compare', 's3.mp3', 14],
  ['jurisprudence', 's4.mp3', 14],
  ['graph', 's5.mp3', 14],
  ['doctrine', 's6.mp3', 12],
  ['cabinet', 's6b.mp3', 14],
  ['pdf', 's7.mp3', 14],
  ['mcp', 's8.mp3', 16],
  ['outro', 's9.mp3', 18],
];

const AudioTrack: React.FC = () => (
  <>
    {VO.map(([scene, file, offset]) => (
      <Sequence key={file} from={SCENE_STARTS[scene] + offset}>
        <Audio src={staticFile(`promo-audio/${file}`)} />
      </Sequence>
    ))}
    <Audio
      src={staticFile('promo-audio/ambience.mp3')}
      loop
      volume={(f) =>
        interpolate(
          f,
          [0, 60, TOTAL_DURATION - 90, TOTAL_DURATION - 20],
          [0, 0.11, 0.11, 0],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        )
      }
    />
  </>
);

export default AudioTrack;
