<template>
  <t-space direction="vertical" :size="16" style="width: 100%">
    <funds-nav />
    <div class="sgl-method">
      <div class="page-hero">
        <h1>收益、波动、回撤的分析与建模</h1>
        <p class="lede">
          基于全市场基金数据，量化刻画收益、波动与回撤之间的内在关系，为基金筛选与组合构建提供可解释的模型依据。
        </p>
      </div>

      <h2>一、数据概览</h2>
      <div class="card">
        <table>
          <tr>
            <th>指标</th>
            <th>Yield</th>
            <th>Vix</th>
            <th>Loss</th>
          </tr>
          <tr>
            <td class="lbl">均值</td>
            <td>14.15</td>
            <td>1.16</td>
            <td>-16.71</td>
          </tr>
          <tr>
            <td class="lbl">标准差</td>
            <td>20.50</td>
            <td>0.96</td>
            <td>13.79</td>
          </tr>
          <tr>
            <td class="lbl">最小值</td>
            <td>-20.89</td>
            <td>0.01</td>
            <td>-65.94</td>
          </tr>
          <tr>
            <td class="lbl">5%分位</td>
            <td>-1.39</td>
            <td>0.02</td>
            <td>-37.69</td>
          </tr>
          <tr>
            <td class="lbl">25%分位</td>
            <td>2.24</td>
            <td>0.11</td>
            <td>-28.27</td>
          </tr>
          <tr>
            <td class="lbl">中位数</td>
            <td>5.89</td>
            <td>1.25</td>
            <td>-18.73</td>
          </tr>
          <tr>
            <td class="lbl">75%分位</td>
            <td>18.55</td>
            <td>1.90</td>
            <td>-1.28</td>
          </tr>
          <tr>
            <td class="lbl">95%分位</td>
            <td>58.16</td>
            <td>2.78</td>
            <td>0.00</td>
          </tr>
          <tr>
            <td class="lbl">最大值</td>
            <td>144.02</td>
            <td>3.88</td>
            <td>0.00</td>
          </tr>
          <tr>
            <td class="lbl">偏度</td>
            <td>2.47</td>
            <td>0.27</td>
            <td>-0.16</td>
          </tr>
          <tr>
            <td class="lbl">峰度</td>
            <td>7.60</td>
            <td>-1.14</td>
            <td>-1.26</td>
          </tr>
        </table>
        <div class="note">
          Loss 取值区间为 [−65.94, 0]，恒为非正，表示下行/回撤幅度；Yield 右偏（偏度
          2.47）且厚尾，存在少数高收益极端样本；Vix 近似对称分布，区间 [0.01, 3.88]。
        </div>
      </div>

      <h2>二、相关性分析</h2>
      <div class="card">
        <img alt="相关系数热力图" src="/methodology/corr-heatmap.png" loading="lazy" />
        <table>
          <tr>
            <th>变量</th>
            <th>Yield</th>
            <th>Vix</th>
            <th>Loss</th>
          </tr>
          <tr>
            <td class="lbl">Yield</td>
            <td>1.000</td>
            <td>0.636 <span class="sig">***</span></td>
            <td>-0.447 <span class="sig">***</span></td>
          </tr>
          <tr>
            <td class="lbl">Vix</td>
            <td>0.636 <span class="sig">***</span></td>
            <td>1.000</td>
            <td>-0.944 <span class="sig">***</span></td>
          </tr>
          <tr>
            <td class="lbl">Loss</td>
            <td>-0.447 <span class="sig">***</span></td>
            <td>-0.944 <span class="sig">***</span></td>
            <td>1.000</td>
          </tr>
        </table>
        <div class="note">
          显著性：*** p&lt;0.001，** p&lt;0.01，* p&lt;0.05。所有相关系数 p≈0，统计极显著。<br />
          Spearman 秩相关结论一致（Vix↔Loss=-0.95, Yield↔Vix=0.67, Yield↔Loss=-0.53），说明关系非由个别极端值驱动。
        </div>
      </div>

      <h2>三、关系可视化</h2>
      <div class="card">
        <h3>4.1 两两散点（含回归线）</h3>
        <img alt="两两散点" src="/methodology/pairwise-scatter.png" loading="lazy" />
        <h3>4.2 各变量分布</h3>
        <img alt="分布" src="/methodology/distributions.png" loading="lazy" />
        <h3>4.3 三维散点（Yield–Vix–Loss）</h3>
        <img alt="三维散点" src="/methodology/scatter-3d.png" loading="lazy" />
        <div class="note">
          Vix–Loss 散点呈紧密负向带状结构，是三者关系的骨架；Yield 轴上高收益样本点分布更分散，对 Loss 的解释力弱于
          Vix。
        </div>
      </div>

      <h2>四、建模数据</h2>
      <div class="card">
        <h3>4.1 多元线性回归（OLS）</h3>
        <p>分别以三者之一为因变量、另两者为自变量建立三个方向模型：</p>
        <table>
          <tr>
            <th>模型</th>
            <th>R²</th>
            <th>AIC</th>
          </tr>
          <tr>
            <td class="lbl">Loss ~ Yield + Vix</td>
            <td>0.9315</td>
            <td>25558.7</td>
          </tr>
          <tr>
            <td class="lbl">Vix ~ Yield + Loss</td>
            <td>0.9491</td>
            <td>-1015.3</td>
          </tr>
          <tr>
            <td class="lbl">Yield ~ Vix + Loss</td>
            <td>0.6233</td>
            <td>37364.8</td>
          </tr>
        </table>

        <h3>4.2 主模型系数：Loss ~ Yield + Vix</h3>
        <table>
          <tr>
            <th>项</th>
            <th>系数</th>
            <th>95% 置信区间</th>
            <th>p 值</th>
          </tr>
          <tr>
            <td class="lbl">const</td>
            <td>-0.7066</td>
            <td>[-0.868, -0.545]</td>
            <td>0.0000 ***</td>
          </tr>
          <tr>
            <td class="lbl">Yield</td>
            <td>0.1739</td>
            <td>[0.167, 0.180]</td>
            <td>0.0000 ***</td>
          </tr>
          <tr>
            <td class="lbl">Vix</td>
            <td>-15.8880</td>
            <td>[-16.027, -15.749]</td>
            <td>0.0000 ***</td>
          </tr>
        </table>
        <div class="note">
          VIF（方差膨胀因子）= 1.679 / 1.679，远小于 5，说明 Yield 与 Vix
          虽相关（r=0.64）但不存在严重多重共线性，系数估计稳定可信。所有系数 p&lt;0.001。
        </div>

        <h3>4.3 残差诊断</h3>
        <img alt="残差诊断" src="/methodology/residual-diag.png" loading="lazy" />
        <div class="note">
          残差围绕 0 随机分布、近似对称，无明显异方差或弯曲结构，线性模型设定基本合理，右尾略存重损失样本。
        </div>
      </div>

      <h2>五、预测分析</h2>
      <div class="card">
        <h3>5.1 预测 Loss（特征：Yield, Vix）</h3>
        <table>
          <tr>
            <th>模型</th>
            <th>R²</th>
            <th>MAE</th>
            <th>RMSE</th>
          </tr>
          <tr>
            <td class="lbl">线性回归</td>
            <td>0.9320</td>
            <td>2.4372</td>
            <td>3.6104</td>
          </tr>
          <tr>
            <td class="lbl">随机森林</td>
            <td>0.9498</td>
            <td>1.9100</td>
            <td>3.1017</td>
          </tr>
        </table>
        <img alt="预测Loss实际vs预测(RF)" src="/methodology/pred-loss-rf.png" loading="lazy" />

        <h3>5.2 预测 Yield（特征：Vix, Loss）</h3>
        <table>
          <tr>
            <th>模型</th>
            <th>R²</th>
            <th>MAE</th>
            <th>RMSE</th>
          </tr>
          <tr>
            <td class="lbl">线性回归</td>
            <td>0.6104</td>
            <td>7.3477</td>
            <td>12.4800</td>
          </tr>
          <tr>
            <td class="lbl">随机森林</td>
            <td>0.6813</td>
            <td>6.3757</td>
            <td>11.2874</td>
          </tr>
        </table>
        <img alt="预测Yield实际vs预测(RF)" src="/methodology/pred-yield-rf.png" loading="lazy" />

        <h3>5.3 预测 Vix（特征：Yield, Loss）</h3>
        <table>
          <tr>
            <th>模型</th>
            <th>R²</th>
            <th>MAE</th>
            <th>RMSE</th>
          </tr>
          <tr>
            <td class="lbl">线性回归</td>
            <td>0.9491</td>
            <td>0.1409</td>
            <td>0.2188</td>
          </tr>
          <tr>
            <td class="lbl">随机森林</td>
            <td>0.9536</td>
            <td>0.1295</td>
            <td>0.2088</td>
          </tr>
        </table>
        <img alt="预测Vix实际vs预测(RF)" src="/methodology/pred-vix-rf.png" loading="lazy" />
        <div class="note">
          Loss 与 Vix 均可被高精度预测（R²≈0.95），说明二者近乎由彼此及收益线性决定；而
          Yield（收益）最难预测（R²≈0.6–0.68），印证"收益包含较多不可由风险/损失解释的噪声"。
        </div>
      </div>

      <h2>六、核心结论</h2>
      <div class="card">
        <div class="kpi">
          <div><b>-0.944</b><span>Vix ↔ Loss 相关系数</span></div>
          <div><b>0.636</b><span>Yield ↔ Vix 相关系数</span></div>
          <div><b>-0.447</b><span>Yield ↔ Loss 相关系数</span></div>
          <div><b>0.931</b><span>Loss~Yield+Vix 回归R²</span></div>
        </div>
        <ul>
          <li>
            <b>波动是损失的主因。</b> Vix（波动率）与 Loss（损失，取值≤0）呈<span class="hl">极强负相关 r=-0.94</span
            >——波动率越高，损失越深。
          </li>
          <li>
            <b>风险收益并存。</b> Yield 与 Vix 正相关 r=0.64：高收益基金普遍伴随更高波动，符合"高风险高收益"规律。
          </li>
          <li><b>收益对冲损失。</b> Yield 与 Loss 负相关 r=-0.45：收益越高的基金，其损失幅度相对越小。</li>
          <li>
            <b>可解释的线性结构。</b> 以 Yield、Vix 解释 Loss 的多元回归 <span class="hl">R²=0.93</span>，近似关系：
            <code>Loss ≈ -15.89 × Vix + 0.174 × Yield -0.71</code><br />
            即 Loss 主要由波动率线性决定（每单位 Vix 约带来 15.9 单位的损失加深），收益仅起次要的"缓冲"作用。
          </li>
          <li>
            <b>结构关系：</b>三者的核心逻辑是 <span class="hl">"波动 → 损失"</span>
            主导，收益在高位时对损失起缓冲作用。波动率决定下行深度，收益决定上行弹性。
          </li>
        </ul>
      </div>
    </div>
  </t-space>
</template>
<script setup lang="ts">
import FundsNav from './FundsNav.vue';

defineOptions({ name: 'FundsResearch' });
</script>
<style scoped>
.sgl-method {
  --bg: var(--td-bg-color-page);
  --card: var(--td-bg-color-container);
  --ink: var(--td-text-color-primary);
  --ink-2: var(--td-text-color-secondary);
  --ink-3: var(--td-text-color-placeholder);
  --line: var(--td-component-border);
  --brand: var(--td-brand-color);
  --brand-600: var(--td-brand-color);
  --brand-700: var(--td-brand-color-hover);
  --brand-soft: var(--td-brand-color-light);
  --shadow: var(--td-shadow-1);
  --radius: var(--td-radius-medium);

  max-width: 1080px;
  color: var(--ink);
  line-height: 1.7;
}

.page-hero {
  padding: 8px 0 4px;
  margin-bottom: 8px;
}

.page-hero h1 {
  font-size: 24px;
  font-weight: 600;
  line-height: 32px;
  margin: 0 0 12px;
  letter-spacing: -0.02em;
  color: var(--ink);
}

.lede {
  margin: 0;
  color: var(--ink-2);
  font-size: 14px;
}

.sgl-method h2 {
  font-size: 18px;
  font-weight: 600;
  line-height: 26px;
  margin: 32px 0 12px;
  color: var(--ink);
}

.sgl-method h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--ink);
  margin: 22px 0 8px;
}

.card {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 22px 24px;
  margin: 16px 0;
  box-shadow: var(--shadow);
}

.sgl-method table {
  border-collapse: collapse;
  width: 100%;
  font-size: 14px;
  margin: 10px 0;
  overflow: hidden;
  border-radius: 12px;
}

.sgl-method th,
.sgl-method td {
  border: 1px solid var(--line);
  padding: 9px 11px;
  text-align: center;
}

.sgl-method th {
  background: var(--brand-soft);
  color: var(--brand-700);
  font-weight: 600;
}

.sgl-method td.lbl {
  text-align: left;
  font-weight: 600;
  background: var(--td-bg-color-secondarycontainer);
}

.sig {
  color: var(--td-error-color);
  font-weight: 700;
}

.note {
  font-size: 12px;
  line-height: 20px;
  color: var(--ink-2);
  background: var(--brand-soft);
  padding: 11px 14px;
  border-radius: var(--radius);
  margin: 12px 0;
}

.kpi {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  margin: 14px 0;
}

.kpi div {
  flex: 1;
  min-width: 150px;
  background: var(--brand-soft);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 16px;
  text-align: center;
}

.kpi b {
  display: block;
  font-size: 24px;
  color: var(--brand-600);
}

.kpi span {
  font-size: 12px;
  color: var(--ink-3);
}

.sgl-method ul {
  margin: 8px 0 8px 4px;
  padding-left: 20px;
}

.sgl-method li {
  margin: 6px 0;
}

.hl {
  background: var(--td-warning-color-1);
  color: var(--td-warning-color);
  padding: 2px 6px;
  border-radius: var(--td-radius-small);
  font-weight: 600;
}

.sgl-method code {
  font-family: var(--td-font-family-mono);
  background: var(--td-bg-color-secondarycontainer);
  padding: 2px 6px;
  border-radius: var(--td-radius-small);
  font-size: 12px;
  color: var(--ink);
}

.sgl-method img {
  max-width: 100%;
  border-radius: 12px;
  display: block;
  margin: 14px auto;
  background: #fff;
  border: 1px solid var(--line);
}

@media (width <= 640px) {
  .page-hero h1 {
    font-size: 24px;
  }

  .card {
    padding: 18px 16px;
  }
}
</style>
