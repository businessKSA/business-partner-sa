import importlib.util,os
_s=importlib.util.spec_from_file_location('cc',os.path.join(os.path.dirname(os.path.abspath(__file__)),'REV-contract-content.py'));c=importlib.util.module_from_spec(_s);_s.loader.exec_module(c)
H,R,TB,PH,N,LB=c.H,c.R,c.TB,c.PH,c.N,c.LB
OUTDIR=os.environ.get('REV_OUTDIR','/home/user/docs/sales/business-development-service/clients/qubbah/internal-edit-copies')
