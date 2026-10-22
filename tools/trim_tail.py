"""녹음 끝에 붙는 '치익' 잡음 제거: 마지막 말소리 뒤 침묵을 지나 다시 나는 짧은 소리를 잘라 낸다."""
import subprocess,sys,numpy as np,os
def trim(path):
  raw=subprocess.run(['ffmpeg','-v','error','-i',path,'-f','s16le','-ac','1','-ar','16000','-'],capture_output=True).stdout
  a=np.frombuffer(raw,np.int16).astype(float);w=320
  e=np.array([20*np.log10(np.sqrt((a[i:i+w]**2).mean())+1) for i in range(0,len(a)-w,w)])
  loud=e>e.max()-35
  segs=[];i=0
  while i<len(loud):
    if loud[i]:
      j=i
      while j<len(loud) and loud[j]:j+=1
      segs.append([i,j]);i=j
    else:i+=1
  # merge gaps < 0.25s
  m=[]
  for s in segs:
    if m and s[0]-m[-1][1]<12:m[-1][1]=s[1]
    else:m.append(s)
  cut=None
  while len(m)>1 and (m[-1][1]-m[-1][0])<=15 and m[-1][0]-m[-2][1]>=8:
    cut=m[-2][1];m.pop()
  if cut is None:return False
  end=(cut+4)*w/16000
  tmp=path+'.tmp.mp3'
  subprocess.run(['ffmpeg','-v','error','-y','-i',path,'-t',f'{end:.3f}','-af',f'afade=t=out:st={max(0,end-0.08):.3f}:d=0.08,apad=pad_dur=0.25','-c:a','libmp3lame','-q:a','2',tmp],check=True)
  os.replace(tmp,path);return True
if __name__=='__main__':
  n=0
  for p in sys.argv[1:]:
    if trim(p):n+=1;print('trimmed',os.path.basename(p))
  print(n,'files')
