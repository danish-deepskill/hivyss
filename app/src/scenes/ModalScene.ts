import Phaser from 'phaser';

interface ModalSceneData {
  wavesCleared: number;
  kills: number;
  elapsed: number;
  points: number;
}

export class ModalScene extends Phaser.Scene {
  constructor() {
    super('ModalScene');
  }

  create(data: ModalSceneData): void {
    const overlay = document.createElement('div');
    overlay.style.cssText = [
      'width:1280px; height:720px',
      'display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px',
      'background:rgba(0,0,0,.88)',
      'font-family:"Courier New",monospace; color:#ddd',
      'z-index:100; position:relative',
    ].join(';');

    const title = document.createElement('div');
    title.style.cssText = 'font-family:"Press Start 2P",monospace; font-size:20px; letter-spacing:2px; color:#f85050;';
    title.textContent = 'BASE DESTROYED!';

    const sub = document.createElement('div');
    sub.style.cssText = 'font-size:14px; color:#888; letter-spacing:2px;';
    sub.textContent = `You survived ${data.wavesCleared} waves`;

    const stats = document.createElement('div');
    stats.style.cssText = 'font-size:13px; color:#665520; line-height:2; text-align:center;';
    stats.innerHTML = `Enemies crushed: ${data.kills}<br>Time survived: ${Math.floor(data.elapsed)}s<br><span style="color:#f0c040">+${data.points} Colony Points</span>`;

    const btn = document.createElement('button');
    btn.style.cssText = 'padding:10px 24px; font-family:"Press Start 2P",monospace; font-size:9px; color:#f0c040; background:#150e04; border:1px solid #f0c040; border-radius:3px; cursor:pointer; letter-spacing:1px; margin-top:4px;';
    btn.textContent = '\u25B6 PLAY AGAIN';
    btn.onmouseover = () => { btn.style.background = '#201508'; };
    btn.onmouseout = () => { btn.style.background = '#150e04'; };
    btn.onclick = () => {
      this.events.emit('restart');
      this.scene.stop();
    };

    overlay.append(title, sub, stats, btn);
    this.add.dom(640, 360, overlay);
  }
}
