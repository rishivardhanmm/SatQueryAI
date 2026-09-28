"""Train a ten-class EuroSAT land-cover tile classifier."""
from __future__ import annotations
import json, random
from pathlib import Path
import numpy as np
import torch
from PIL import Image
from sklearn.metrics import accuracy_score, classification_report, f1_score
from sklearn.model_selection import train_test_split
from torch import nn
from torch.utils.data import DataLoader, Dataset
from torchvision import transforms

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'data' / 'raw' / '2750'
OUT = ROOT / 'ml' / 'landcover_classifier' / 'artifacts'
SEED, EPOCHS, BATCH = 26167, 8, 128
CLASSES = sorted(p.name for p in DATA.iterdir() if p.is_dir())

class Dataset(Dataset):
    def __init__(self, items, transform): self.items,self.transform=items,transform
    def __len__(self): return len(self.items)
    def __getitem__(self,i):
        p,y=self.items[i]
        return self.transform(Image.open(p).convert('RGB')),y

class LandCoverCNN(nn.Module):
    def __init__(self, n=10):
        super().__init__()
        self.features=nn.Sequential(
            nn.Conv2d(3,32,3,padding=1),nn.BatchNorm2d(32),nn.ReLU(),nn.MaxPool2d(2),
            nn.Conv2d(32,64,3,padding=1),nn.BatchNorm2d(64),nn.ReLU(),nn.MaxPool2d(2),
            nn.Conv2d(64,128,3,padding=1),nn.BatchNorm2d(128),nn.ReLU(),nn.MaxPool2d(2),
            nn.Conv2d(128,128,3,padding=1),nn.BatchNorm2d(128),nn.ReLU(),nn.AdaptiveAvgPool2d(1))
        self.head=nn.Sequential(nn.Flatten(),nn.Dropout(.25),nn.Linear(128,n))
    def forward(self,x): return self.head(self.features(x))

def evaluate(model, loader, device):
    model.eval(); truth=[]; pred=[]
    with torch.no_grad():
        for x,y in loader:
            truth += y.tolist(); pred += model(x.to(device)).argmax(1).cpu().tolist()
    return truth,pred

def main():
    random.seed(SEED);np.random.seed(SEED);torch.manual_seed(SEED);OUT.mkdir(parents=True,exist_ok=True)
    items=[]
    for label,name in enumerate(CLASSES): items += [(str(p),label) for p in (DATA/name).glob('*.jpg')]
    y=[x[1] for x in items]
    train,tmp=train_test_split(items,test_size=.30,stratify=y,random_state=SEED)
    val,test=train_test_split(tmp,test_size=.50,stratify=[x[1] for x in tmp],random_state=SEED)
    norm=transforms.Normalize((.485,.456,.406),(.229,.224,.225))
    aug=transforms.Compose([transforms.RandomHorizontalFlip(),transforms.RandomVerticalFlip(),transforms.RandomRotation(20),transforms.ToTensor(),norm])
    plain=transforms.Compose([transforms.ToTensor(),norm])
    loaders=[DataLoader(Dataset(train,aug),batch_size=BATCH,shuffle=True),DataLoader(Dataset(val,plain),batch_size=BATCH),DataLoader(Dataset(test,plain),batch_size=BATCH)]
    device=torch.device('mps' if torch.backends.mps.is_available() else 'cpu'); model=LandCoverCNN(len(CLASSES)).to(device); opt=torch.optim.AdamW(model.parameters(),lr=1e-3,weight_decay=1e-4); loss=nn.CrossEntropyLoss(); best=(-1,None)
    for epoch in range(1,EPOCHS+1):
        model.train()
        for x,y in loaders[0]:
            opt.zero_grad(); l=loss(model(x.to(device)),y.to(device));l.backward();opt.step()
        truth,pred=evaluate(model,loaders[1],device); score=f1_score(truth,pred,average='macro')
        print(f'epoch {epoch}: validation macro-F1 {score:.4f}',flush=True)
        if score>best[0]:best=(score,{k:v.cpu().clone() for k,v in model.state_dict().items()})
    model.load_state_dict(best[1]);truth,pred=evaluate(model,loaders[2],device)
    metrics={'experiment':'EuroSAT RGB 10-class land-cover tile classification','classes':CLASSES,'train_examples':len(train),'validation_examples':len(val),'test_examples':len(test),'best_validation_macro_f1':best[0],'test_accuracy':accuracy_score(truth,pred),'test_macro_f1':f1_score(truth,pred,average='macro'),'classification_report':classification_report(truth,pred,target_names=CLASSES,output_dict=True,zero_division=0)}
    (OUT/'metrics.json').write_text(json.dumps(metrics,indent=2));torch.save({'model_state_dict':model.state_dict(),'classes':CLASSES,'metrics':metrics},OUT/'landcover-cnn-eurosat.pt');print(json.dumps({k:metrics[k] for k in ('test_accuracy','test_macro_f1')},indent=2))
if __name__=='__main__': main()
