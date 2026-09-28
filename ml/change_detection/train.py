"""Train a compact Siamese U-Net on LEVIR-style building-change masks.

Expected ignored local layout:
data/processed/levir/{train,val,test}/{A,B,label}/*.png
where A and B are co-registered before/after RGB images and label is a binary
building-change mask.  The official data, metrics, and checkpoint are kept out
of Git; only reproducible source is committed.
"""
from __future__ import annotations
import json, random
from pathlib import Path
import numpy as np
import torch
from PIL import Image
from torch import nn
from torch.utils.data import DataLoader, Dataset
from torchvision import transforms

ROOT=Path(__file__).resolve().parents[2]; DATA=ROOT/'data'/'processed'/'levir'; OUT=ROOT/'ml'/'change_detection'/'artifacts'
SEED,EPOCHS,BATCH,SIZE=26167,30,12,256

def samples(split):
    root=DATA/split; entries=[]
    for before in sorted((root/'A').glob('*')):
        after=root/'B'/before.name; mask=root/'label'/before.name
        if after.exists() and mask.exists(): entries.append((before,after,mask))
    if not entries: raise RuntimeError(f'No paired LEVIR samples at {root}; expected A, B and label directories.')
    return entries

class Pairs(Dataset):
    def __init__(self, items, train=False): self.items,self.train=items,train
    def __len__(self): return len(self.items)
    def _image(self,path):
        image=Image.open(path).convert('RGB'); return transforms.functional.resize(image,(SIZE,SIZE))
    def __getitem__(self,i):
        a,b,mask=self.items[i]; a,b,m=self._image(a),self._image(b),Image.open(mask).convert('L')
        m=transforms.functional.resize(m,(SIZE,SIZE),interpolation=transforms.InterpolationMode.NEAREST)
        if self.train and random.random()<.5: a,b,m=a.transpose(Image.Transpose.FLIP_LEFT_RIGHT),b.transpose(Image.Transpose.FLIP_LEFT_RIGHT),m.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        norm=lambda x: transforms.functional.normalize(transforms.functional.to_tensor(x),(.485,.456,.406),(.229,.224,.225))
        return norm(a),norm(b),(torch.from_numpy(np.asarray(m,dtype=np.uint8))>127).float()

class Block(nn.Module):
    def __init__(self,a,b): super().__init__();self.block=nn.Sequential(nn.Conv2d(a,b,3,padding=1),nn.BatchNorm2d(b),nn.ReLU(),nn.Conv2d(b,b,3,padding=1),nn.BatchNorm2d(b),nn.ReLU())
    def forward(self,x): return self.block(x)
class SiameseUNet(nn.Module):
    def __init__(self):
        super().__init__();self.e1=Block(3,32);self.e2=Block(32,64);self.e3=Block(64,128);self.pool=nn.MaxPool2d(2);self.b=Block(128,256);self.u3=nn.ConvTranspose2d(256,128,2,2);self.d3=Block(256,128);self.u2=nn.ConvTranspose2d(128,64,2,2);self.d2=Block(128,64);self.u1=nn.ConvTranspose2d(64,32,2,2);self.d1=Block(64,32);self.out=nn.Conv2d(32,1,1)
    def encode(self,x):
        a=self.e1(x);b=self.e2(self.pool(a));c=self.e3(self.pool(b));return a,b,c,self.b(self.pool(c))
    def forward(self,before,after):
        x=[torch.abs(a-b) for a,b in zip(self.encode(before),self.encode(after))]
        d3=self.d3(torch.cat([self.u3(x[3]),x[2]],1));d2=self.d2(torch.cat([self.u2(d3),x[1]],1));d1=self.d1(torch.cat([self.u1(d2),x[0]],1));return self.out(d1).squeeze(1)

def score(model,loader,device):
    tp=fp=fn=0;model.eval()
    with torch.no_grad():
        for a,b,y in loader:
            p=torch.sigmoid(model(a.to(device),b.to(device))).cpu()>=.5; y=y.bool();tp+=(p&y).sum().item();fp+=(p&~y).sum().item();fn+=(~p&y).sum().item()
    precision=tp/(tp+fp) if tp+fp else 0.;recall=tp/(tp+fn) if tp+fn else 0.;f1=2*precision*recall/(precision+recall) if precision+recall else 0.;iou=tp/(tp+fp+fn) if tp+fp+fn else 0.
    return {'precision':precision,'recall':recall,'f1':f1,'change_iou':iou,'true_positive_pixels':tp,'false_positive_pixels':fp,'false_negative_pixels':fn}

def main():
    random.seed(SEED);np.random.seed(SEED);torch.manual_seed(SEED);OUT.mkdir(parents=True,exist_ok=True)
    train=samples('train');val=samples('val');test=samples('test');device=torch.device('mps' if torch.backends.mps.is_available() else 'cpu')
    loaders=[DataLoader(Pairs(train,True),batch_size=BATCH,shuffle=True),DataLoader(Pairs(val),batch_size=BATCH),DataLoader(Pairs(test),batch_size=BATCH)]
    model=SiameseUNet().to(device);optimizer=torch.optim.AdamW(model.parameters(),lr=3e-4,weight_decay=1e-4);loss=nn.BCEWithLogitsLoss();best=(-1,None)
    for epoch in range(1,EPOCHS+1):
        model.train()
        for a,b,y in loaders[0]:
            optimizer.zero_grad();value=loss(model(a.to(device),b.to(device)),y.to(device));value.backward();optimizer.step()
        metrics=score(model,loaders[1],device);print(f"epoch {epoch}: validation change F1 {metrics['f1']:.4f}",flush=True)
        if metrics['f1']>best[0]:best=(metrics['f1'],{k:v.cpu().clone() for k,v in model.state_dict().items()})
    model.load_state_dict(best[1]);metrics={'dataset':'LEVIR-CD official building-change masks','train_pairs':len(train),'validation_pairs':len(val),'test_pairs':len(test),'best_validation_f1':best[0],'held_out_test':score(model,loaders[2],device),'image_size':SIZE}
    (OUT/'metrics.json').write_text(json.dumps(metrics,indent=2));torch.save({'model_state_dict':model.state_dict(),'metrics':metrics},OUT/'levir-siamese-unet.pt');print(json.dumps(metrics['held_out_test'],indent=2))
if __name__=='__main__': main()
