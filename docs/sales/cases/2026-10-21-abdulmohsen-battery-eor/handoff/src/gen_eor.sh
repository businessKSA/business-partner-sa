cd "$(dirname "$0")"
python3 gen_ct.py
MODE=ar python3 m_ct.py; MODE=en python3 m_ct.py
cp outm/project/CT* out/project/
