"""
英语听力陷阱算法（含重音区分）

依赖:
    pip install numpy scipy

数据:
    下载 cmudict-0.7b 放到同目录下
    https://github.com/cmusphinx/cmudict
"""

import re
import numpy as np
from scipy.spatial import cKDTree

# ============================================================
# 1. 音素定义（保留重音标记）
# ============================================================

# CMU 元音音素 + 重音变体
VOWELS_STRESSED = [
    'AA0', 'AA1', 'AA2',
    'AE0', 'AE1', 'AE2',
    'AH0', 'AH1', 'AH2',
    'AO0', 'AO1', 'AO2',
    'AW0', 'AW1', 'AW2',
    'AY0', 'AY1', 'AY2',
    'EH0', 'EH1', 'EH2',
    'ER0', 'ER1', 'ER2',
    'EY0', 'EY1', 'EY2',
    'IH0', 'IH1', 'IH2',
    'IY0', 'IY1', 'IY2',
    'OW0', 'OW1', 'OW2',
    'OY0', 'OY1', 'OY2',
    'UH0', 'UH1', 'UH2',
    'UW0', 'UW1', 'UW2',
]

# 辅音（无重音变化）
CONSONANTS = [
    'B', 'CH', 'D', 'DH', 'F', 'G', 'HH', 'JH', 'K',
    'L', 'M', 'N', 'NG', 'P', 'R', 'S', 'SH', 'T',
    'TH', 'V', 'W', 'Y', 'Z', 'ZH',
]

# 完整音素表
PHONEME_LIST = CONSONANTS + VOWELS_STRESSED
PHONEME_TO_IDX = {p: i for i, p in enumerate(PHONEME_LIST)}
DIMENSION = len(PHONEME_LIST)  # 67 维

# ============================================================
# 2. 音素混淆矩阵（含重音变体）
# ============================================================

PHONEME_CONFUSION = {}


def _add_confusion(p1, p2, cost):
    """双向添加混淆关系"""
    PHONEME_CONFUSION[(p1, p2)] = cost
    PHONEME_CONFUSION[(p2, p1)] = cost


def _add_vowel_confusion(base1, base2, cost):
    """为元音的所有重音变体添加混淆关系"""
    for stress in ['0', '1', '2']:
        _add_confusion(base1 + stress, base2 + stress, cost)


def _add_stress_confusion(base, cost_light, cost_medium):
    """
    同一元音不同重音级别的混淆
    0-1 比 0-2 更容易混淆（轻读和主重音差别最大）
    """
    _add_confusion(base + '0', base + '1', cost_light)
    _add_confusion(base + '0', base + '2', cost_medium)
    _add_confusion(base + '1', base + '2', cost_medium)


# --- 辅音混淆 ---
_add_confusion('TH', 'F', 0.2)
_add_confusion('TH', 'S', 0.3)
_add_confusion('TH', 'T', 0.4)
_add_confusion('DH', 'D', 0.3)
_add_confusion('DH', 'V', 0.4)
_add_confusion('L', 'R', 0.1)
_add_confusion('V', 'W', 0.2)
_add_confusion('B', 'P', 0.4)
_add_confusion('D', 'T', 0.4)
_add_confusion('G', 'K', 0.4)
_add_confusion('N', 'NG', 0.3)
_add_confusion('S', 'Z', 0.3)
_add_confusion('SH', 'ZH', 0.3)
_add_confusion('SH', 'S', 0.3)
_add_confusion('CH', 'JH', 0.4)

# --- 相近元音混淆（同重音级别）---
_add_vowel_confusion('IH', 'IY', 0.3)
_add_vowel_confusion('EH', 'AE', 0.3)
_add_vowel_confusion('UH', 'UW', 0.3)
_add_vowel_confusion('AH', 'EH', 0.4)
_add_vowel_confusion('AH', 'IH', 0.4)
_add_vowel_confusion('ER', 'AH', 0.4)
_add_vowel_confusion('EY', 'EH', 0.3)
_add_vowel_confusion('AY', 'IH', 0.4)
_add_vowel_confusion('OW', 'AO', 0.3)
_add_vowel_confusion('AW', 'AO', 0.3)

# --- 同一元音不同重音级别混淆 ---
for vowel in ['AA', 'AE', 'AH', 'AO', 'AW', 'AY',
              'EH', 'ER', 'EY', 'IH', 'IY',
              'OW', 'OY', 'UH', 'UW']:
    _add_stress_confusion(vowel, cost_light=0.3, cost_medium=0.5)


def get_confusion_cost(p1, p2):
    if p1 == p2:
        return 0.0
    key = (p1, p2)
    return PHONEME_CONFUSION.get(key, 1.0)


# ============================================================
# 3. 解析 CMU 词典（保留原始音素，含重音数字）
# ============================================================

def parse_cmu_dict(filepath='cmudict-0.7b'):
    """
    解析 CMU 词典，保留重音标记
    返回: { 'HELLO': ['HH', 'AH0', 'L', 'OW1'], ... }
    """
    dictionary = {}

    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith(';;;'):
                continue

            parts = re.split(r'\s{2,}', line)
            if len(parts) != 2:
                continue

            raw_word, phonemes_str = parts

            # 只保留纯字母单词
            clean_word = re.sub(r'[^A-Za-z]', '', raw_word)
            if not clean_word:
                continue

            word = clean_word.upper()
            # 关键区别：保留原始音素，不去掉数字
            phonemes = phonemes_str.strip().split()

            if word not in dictionary:
                dictionary[word] = phonemes

    return dictionary


# ============================================================
# 4. 音素向量编码（含重音）
# ============================================================

def phonemes_to_vector(phonemes, dim=DIMENSION):
    """
    将音素序列编码为固定长度向量
    保留重音标记，AH0/AH1/AH2 映射到不同维度
    """
    vec = np.zeros(dim, dtype=np.float32)

    for i, p in enumerate(phonemes):
        if p in PHONEME_TO_IDX:
            position_weight = 1.0 / (1.0 + i * 0.3)
            vec[PHONEME_TO_IDX[p]] += position_weight

    norm = np.linalg.norm(vec)
    if norm > 0:
        vec = vec / norm

    return vec


# ============================================================
# 5. 索引类
# ============================================================

class HearingTrapIndex:

    def __init__(self, dict_path='cmudict-0.7b'):
        print(f'正在解析词典: {dict_path} ...')
        self.dictionary = parse_cmu_dict(dict_path)
        print(f'已加载 {len(self.dictionary)} 个单词')

        print('正在构建音素向量 ...')
        self.words = []
        self.phonemes_map = {}
        vectors = []

        for word, phonemes in self.dictionary.items():
            self.words.append(word)
            self.phonemes_map[word] = phonemes
            vectors.append(phonemes_to_vector(phonemes))

        self.vectors = np.array(vectors, dtype=np.float32)

        print('正在构建 KD-Tree 索引 ...')
        self.tree = cKDTree(self.vectors)
        print(f'索引构建完成 (维度: {DIMENSION})')

    def find_similar(self, word, k=5):
        """查找发音最相似的 k 个词"""
        word = word.upper()
        if word not in self.phonemes_map:
            raise ValueError(f'词典中不存在: {word}')

        target_vec = phonemes_to_vector(self.phonemes_map[word])
        distances, indices = self.tree.query(target_vec, k=k + 1)

        results = []
        for dist, idx in zip(distances, indices):
            w = self.words[idx]
            if w != word:
                results.append((w, self.phonemes_map[w], round(float(dist), 4)))
            if len(results) >= k:
                break

        return results

    def trap_score(self, word):
        """计算陷阱密度分数"""
        word = word.upper()
        if word not in self.phonemes_map:
            raise ValueError(f'词典中不存在: {word}')

        target_vec = phonemes_to_vector(self.phonemes_map[word])
        neighbors = self.tree.query_ball_point(target_vec, 0.3)
        return len(neighbors) - 1


# ============================================================
# 6. 加权编辑距离（精确比较）
# ============================================================

def weighted_phoneme_distance(seq1, seq2):
    """基于混淆矩阵的加权编辑距离"""
    m, n = len(seq1), len(seq2)
    dp = [[0.0] * (n + 1) for _ in range(m + 1)]

    for i in range(m + 1):
        dp[i][0] = float(i)
    for j in range(n + 1):
        dp[0][j] = float(j)

    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if seq1[i - 1] == seq2[j - 1]:
                dp[i][j] = dp[i - 1][j - 1]
            else:
                dp[i][j] = min(
                    dp[i - 1][j] + 1.0,
                    dp[i][j - 1] + 1.0,
                    dp[i - 1][j - 1] + get_confusion_cost(seq1[i - 1], seq2[j - 1])
                )

    max_len = max(len(seq1), len(seq2))
    return dp[m][n] / max_len if max_len > 0 else 0.0


# ============================================================
# 7. 主程序
# ============================================================

if __name__ == '__main__':

    index = HearingTrapIndex('cmudict-0.7b')

    # --- 查找相似词 ---
    test_words = ['THREE', 'NIGHT', 'SHEEP', 'VINE']

    for word in test_words:
        print(f'\n{"=" * 55}')
        print(f'  {word}  [{", ".join(index.phonemes_map[word])}]')
        print(f'{"=" * 55}')

        similar = index.find_similar(word, k=5)
        for w, phonemes, dist in similar:
            print(f'  {w:<15} [{", ".join(phonemes):<30}]  距离: {dist}')

    # --- 精确距离比较（展示重音的影响）---
    print(f'\n{"=" * 55}')
    print('  重音差异示例')
    print(f'{"=" * 55}')

    # 同一单词不同发音的重音差异
    print(f'\n  HELLO (AH0 弱读) vs HELLO(2) (EH0 弱读):')
    print(f'    AH0 和 EH0 距离: {get_confusion_cost("AH0", "EH0")}')

    # 展示重音级别差异
    print(f'\n  同一元音不同重音:')
    print(f'    AH0 vs AH1 距离: {get_confusion_cost("AH0", "AH1")}')
    print(f'    AH0 vs AH2 距离: {get_confusion_cost("AH0", "AH2")}')
    print(f'    AH1 vs AH2 距离: {get_confusion_cost("AH1", "AH2")}')
