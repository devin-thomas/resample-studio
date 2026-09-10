import assert from 'node:assert';
import test, { describe, it } from 'node:test';
import type { RepeatMode } from '../src/types/audio.ts';

// Model the playlist transition state machine extracted from App.tsx
interface TrackItem {
  id: string;
  name: string;
}

interface TransitionResult {
  action: 'restart' | 'change_track' | 'stop';
  nextTrackId?: string;
  autoPlayNext?: boolean;
}

function computeTrackEndedAction(
  tracks: TrackItem[],
  activeTrackId: string | null,
  repeatMode: RepeatMode,
  isShuffle = false
): TransitionResult {
  if (tracks.length === 0) {
    return { action: 'stop' };
  }

  if (repeatMode === 'one') {
    return { action: 'restart' };
  }

  const curIdx = tracks.findIndex((t) => t.id === activeTrackId);

  if (isShuffle) {
    if (tracks.length === 1) {
      if (repeatMode === 'all') {
        return { action: 'restart' };
      } else {
        return { action: 'stop' };
      }
    }
    let randomIdx = Math.floor(Math.random() * (tracks.length - 1));
    if (randomIdx >= curIdx) randomIdx++;
    return {
      action: 'change_track',
      nextTrackId: tracks[randomIdx].id,
      autoPlayNext: true,
    };
  }

  if (curIdx < tracks.length - 1) {
    return {
      action: 'change_track',
      nextTrackId: tracks[curIdx + 1].id,
      autoPlayNext: true,
    };
  } else {
    // End of playlist reached
    if (repeatMode === 'all') {
      if (tracks.length === 1 || tracks[0].id === activeTrackId) {
        return { action: 'restart' };
      } else {
        return {
          action: 'change_track',
          nextTrackId: tracks[0].id,
          autoPlayNext: true,
        };
      }
    } else {
      return { action: 'stop' };
    }
  }
}

function computeNativeLoopState(repeatMode: RepeatMode, trackCount: number): boolean {
  return repeatMode === 'one' || (repeatMode === 'all' && trackCount === 1);
}

function computeNextTrackAction(
  tracks: TrackItem[],
  activeTrackId: string | null,
  isShuffle = false
): TransitionResult {
  if (tracks.length === 0) return { action: 'stop' };
  const curIdx = tracks.findIndex((t) => t.id === activeTrackId);

  if (isShuffle && tracks.length > 1) {
    let randomIdx = Math.floor(Math.random() * (tracks.length - 1));
    if (randomIdx >= curIdx) randomIdx++;
    return {
      action: 'change_track',
      nextTrackId: tracks[randomIdx].id,
    };
  }

  const nextIdx = curIdx < tracks.length - 1 ? curIdx + 1 : 0;
  if (tracks[nextIdx].id === activeTrackId) {
    return { action: 'restart' };
  }
  return {
    action: 'change_track',
    nextTrackId: tracks[nextIdx].id,
  };
}

describe('Playlist & Repeat Transition Contracts', () => {
  const singleTrackPlaylist: TrackItem[] = [{ id: 'track-1', name: 'song.mp3' }];
  const multiTrackPlaylist: TrackItem[] = [
    { id: 'track-1', name: 'song1.mp3' },
    { id: 'track-2', name: 'song2.mp3' },
    { id: 'track-3', name: 'song3.mp3' },
  ];

  it('1/1 track playlist restarts when repeatMode is all (default)', () => {
    const result = computeTrackEndedAction(singleTrackPlaylist, 'track-1', 'all');
    assert.strictEqual(result.action, 'restart', 'Single track with Repeat All must restart playback');
  });

  it('1/1 track playlist enables native HTMLAudioElement loop for gapless playback', () => {
    const loopOnRepeatAll = computeNativeLoopState('all', 1);
    assert.strictEqual(loopOnRepeatAll, true, 'audioElement.loop must be true for 1-track playlist on Repeat All');

    const loopOnRepeatOne = computeNativeLoopState('one', 1);
    assert.strictEqual(loopOnRepeatOne, true, 'audioElement.loop must be true for Repeat One');

    const loopOnRepeatNone = computeNativeLoopState('none', 1);
    assert.strictEqual(loopOnRepeatNone, false, 'audioElement.loop must be false when repeat is off');

    const loopMultiRepeatAll = computeNativeLoopState('all', 3);
    assert.strictEqual(loopMultiRepeatAll, false, 'audioElement.loop must be false for multi-track on Repeat All');
  });

  it('1/1 track playlist restarts when repeatMode is one', () => {
    const result = computeTrackEndedAction(singleTrackPlaylist, 'track-1', 'one');
    assert.strictEqual(result.action, 'restart');
  });

  it('1/1 track playlist stops when repeatMode is none', () => {
    const result = computeTrackEndedAction(singleTrackPlaylist, 'track-1', 'none');
    assert.strictEqual(result.action, 'stop');
  });

  it('Manual next track on 1/1 track playlist restarts instead of doing nothing', () => {
    const result = computeNextTrackAction(singleTrackPlaylist, 'track-1');
    assert.strictEqual(result.action, 'restart');
  });

  it('Multi-track playlist advances sequentially and loops on Repeat All', () => {
    // Track 1 -> Track 2
    const step1 = computeTrackEndedAction(multiTrackPlaylist, 'track-1', 'all');
    assert.strictEqual(step1.action, 'change_track');
    assert.strictEqual(step1.nextTrackId, 'track-2');

    // Track 2 -> Track 3
    const step2 = computeTrackEndedAction(multiTrackPlaylist, 'track-2', 'all');
    assert.strictEqual(step2.action, 'change_track');
    assert.strictEqual(step2.nextTrackId, 'track-3');

    // Track 3 (End) -> Track 1
    const step3 = computeTrackEndedAction(multiTrackPlaylist, 'track-3', 'all');
    assert.strictEqual(step3.action, 'change_track');
    assert.strictEqual(step3.nextTrackId, 'track-1');
  });

  it('Multi-track playlist stops at end when repeatMode is none', () => {
    const result = computeTrackEndedAction(multiTrackPlaylist, 'track-3', 'none');
    assert.strictEqual(result.action, 'stop');
  });
});
