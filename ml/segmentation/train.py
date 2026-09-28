"""Train a compact pixel-mask baseline from official LoveDA RGB masks.

LoveDA's masks use 0=ignore, 1=background, 2=building, 3=road, 4=water,
5=barren, 6=forest, and 7=agriculture.  The output has seven classes with
the ignore label excluded from the loss and metrics.
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

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'data' / 'processed' / 'loveda'
OUT = ROOT / 'ml' / 'segmentation' / 'artifacts'
SEED, EPOCHS, BATCH, SIZE = 26167, 30, 8, 512
CLASS_NAMES = ['background', 'building', 'road', 'water', 'barren', 'forest', 'agriculture']

def pairs(split: str):
    images = sorted((DATA / split).rglob('images_png/*.png'))
    result = []
    for image in images:
        mask = image.parent.parent / 'masks_png' / image.name
        if mask.exists(): result.append((image, mask))
    if not result: raise RuntimeError(f'No LoveDA image/mask pairs found under {DATA / split}')
    return result

class LoveDA(Dataset):
    def __init__(self, items, train=False): self.items, self.train = items, train
    def __len__(self): return len(self.items)
    def __getitem__(self, index):
        image = Image.open(self.items[index][0]).convert('RGB'); mask = Image.open(self.items[index][1])
        if self.train and random.random() < .5: image, mask = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT), mask.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        image = transforms.functional.resize(image, (SIZE, SIZE)); mask = transforms.functional.resize(mask, (SIZE, SIZE), interpolation=transforms.InterpolationMode.NEAREST)
        x = transforms.functional.normalize(transforms.functional.to_tensor(image), (.485,.456,.406), (.229,.224,.225))
        y = torch.from_numpy(np.asarray(mask, dtype=np.int64))
        # Keep 0 as ignore, map official classes 1..7 to our 0..6 outputs.
        y = torch.where(y == 0, torch.full_like(y, 255), y - 1)
        return x, y

class DoubleConv(nn.Module):
    def __init__(self, a, b): super().__init__(); self.block = nn.Sequential(nn.Conv2d(a,b,3,padding=1),nn.BatchNorm2d(b),nn.ReLU(),nn.Conv2d(b,b,3,padding=1),nn.BatchNorm2d(b),nn.ReLU())
    def forward(self,x): return self.block(x)
class TinyUNet(nn.Module):
    def __init__(self, classes=7):
        super().__init__(); self.e1=DoubleConv(3,32);self.e2=DoubleConv(32,64);self.e3=DoubleConv(64,128);self.pool=nn.MaxPool2d(2);self.b=DoubleConv(128,256);self.u3=nn.ConvTranspose2d(256,128,2,2);self.d3=DoubleConv(256,128);self.u2=nn.ConvTranspose2d(128,64,2,2);self.d2=DoubleConv(128,64);self.u1=nn.ConvTranspose2d(64,32,2,2);self.d1=DoubleConv(64,32);self.out=nn.Conv2d(32,classes,1)
    def forward(self,x):
        e1=self.e1(x);e2=self.e2(self.pool(e1));e3=self.e3(self.pool(e2));b=self.b(self.pool(e3));d3=self.d3(torch.cat([self.u3(b),e3],1));d2=self.d2(torch.cat([self.u2(d3),e2],1));d1=self.d1(torch.cat([self.u1(d2),e1],1));return self.out(d1)

def miou(model, loader, device):
    matrix = torch.zeros(7, 7, dtype=torch.int64)
    model.eval()
    with torch.no_grad():
        for x,y in loader:
            p=model(x.to(device)).argmax(1).cpu(); valid=y != 255
            # Vectorised confusion update: a Python loop over every 512px
            # validation pixel would make a full epoch impractically slow.
            encoded = y[valid] * 7 + p[valid]
            matrix += torch.bincount(encoded, minlength=49).reshape(7, 7)
    scores=[]
    for i in range(7):
        denom=matrix[i,:].sum()+matrix[:,i].sum()-matrix[i,i]
        if denom: scores.append((matrix[i,i].float()/denom).item())
    return float(np.mean(scores)), matrix.tolist()

def main():
    random.seed(SEED); np.random.seed(SEED); torch.manual_seed(SEED); OUT.mkdir(parents=True,exist_ok=True)
    train, val = pairs('Train'), pairs('Val'); device=torch.device('mps' if torch.backends.mps.is_available() else 'cpu')
    train_loader=DataLoader(LoveDA(train, True), batch_size=BATCH, shuffle=True, num_workers=0); val_loader=DataLoader(LoveDA(val), batch_size=BATCH, num_workers=0)
    model=TinyUNet().to(device); optimizer=torch.optim.AdamW(model.parameters(),lr=3e-4,weight_decay=1e-4); loss=nn.CrossEntropyLoss(ignore_index=255); best=(-1,None)
    for epoch in range(1,EPOCHS+1):
        model.train()
        for x,y in train_loader:
            optimizer.zero_grad(); value=loss(model(x.to(device)),y.to(device));value.backward();optimizer.step()
        score,_=miou(model,val_loader,device);print(f'epoch {epoch}: validation mIoU {score:.4f}',flush=True)
        if score>best[0]: best=(score,{k:v.cpu().clone() for k,v in model.state_dict().items()})
    model.load_state_dict(best[1]); final, matrix=miou(model,val_loader,device)
    metrics={'dataset':'LoveDA official Train/Val RGB segmentation masks','classes':CLASS_NAMES,'train_images':len(train),'validation_images':len(val),'best_validation_miou':best[0],'final_validation_miou':final,'confusion_matrix':matrix,'image_size':SIZE}
    (OUT/'metrics.json').write_text(json.dumps(metrics,indent=2));torch.save({'model_state_dict':model.state_dict(),'classes':CLASS_NAMES,'metrics':metrics},OUT/'loveda-tinyunet.pt')
if __name__ == '__main__': main()
